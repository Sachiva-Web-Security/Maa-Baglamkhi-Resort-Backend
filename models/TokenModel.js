const crypto = require("crypto");
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureColumn = async (tableName, columnName, definition) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (!rows.length) {
    await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureIndex = async (tableName, indexName, definition) => {
  const rows = await runQuery(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (!rows.length) {
    await runQuery(`ALTER TABLE ${tableName} ADD ${definition}`);
  }
};

const buildVisitCode = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `VIS-${stamp}-${random}`;
};

const assignMissingVisitCodes = async () => {
  const rows = await runQuery("SELECT id FROM tokens WHERE token_code IS NULL OR token_code = ''");
  for (const row of rows) {
    await runQuery("UPDATE tokens SET token_code = ? WHERE id = ?", [buildVisitCode(), row.id]);
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tableNumber VARCHAR(50) NOT NULL,
      waiter VARCHAR(191) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS token_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token_id INT NOT NULL,
      item_name VARCHAR(191) NOT NULL,
      qty INT NOT NULL DEFAULT 1,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("tokens", "token_code", "VARCHAR(40) DEFAULT NULL AFTER id");
  await ensureIndex("tokens", "idx_tokens_table", "INDEX idx_tokens_table (tableNumber)");
  await ensureIndex("tokens", "idx_tokens_status", "INDEX idx_tokens_status (status)");
  await ensureIndex("tokens", "uniq_tokens_token_code", "UNIQUE KEY uniq_tokens_token_code (token_code)");
  await assignMissingVisitCodes();
};

const getActiveTokenByTable = (tableNumber, callback) => {
  const sql = `
    SELECT * FROM tokens
    WHERE tableNumber = ? AND status='active'
    ORDER BY id DESC
    LIMIT 1
  `;
  db.query(sql, [tableNumber], (err, result) => {
    callback(err, result?.[0] || null);
  });
};

const createToken = (data, callback) => {
  getActiveTokenByTable(data.tableNumber, async (lookupErr, activeToken) => {
    if (lookupErr) {
      callback(lookupErr);
      return;
    }

    try {
      if (activeToken?.id) {
        const paidBills = await runQuery(
          `
            SELECT id
            FROM bills
            WHERE token_id = ?
              AND (
                LOWER(COALESCE(invoiceStatus, '')) = 'paid'
                OR account_transaction_id IS NOT NULL
              )
            ORDER BY id DESC
            LIMIT 1
          `,
          [activeToken.id],
        );

        if (!paidBills.length) {
          callback(null, {
            insertId: activeToken.id,
            existing: true,
            token: activeToken,
          });
          return;
        }

        await runQuery(
          "UPDATE tokens SET status='closed' WHERE id = ? AND status='active'",
          [activeToken.id],
        );
      }

      const nextTokenCode = buildVisitCode();
      const result = await runQuery(
        `
          INSERT INTO tokens (token_code, tableNumber, waiter, status)
          VALUES (?, ?, ?, 'active')
        `,
        [nextTokenCode, data.tableNumber, data.waiter],
      );

      callback(null, {
        ...result,
        token_code: nextTokenCode,
      });
    } catch (error) {
      callback(error);
    }
  });
};

const getTokenByTable = (table, callback) => {
  const sql = `
    SELECT * FROM tokens
    WHERE tableNumber = ? AND status='active'
  `;
  db.query(sql, [table], (err, result) => {
    callback(err, result[0]);
  });
};

const getTokenById = (tokenId, callback) => {
  db.query("SELECT * FROM tokens WHERE id = ? LIMIT 1", [tokenId], (err, result) => {
    callback(err, result?.[0] || null);
  });
};

const addTokenItem = (data, callback) => {
  const sql = `
    INSERT INTO token_items (token_id, item_name, qty, rate)
    VALUES (?, ?, ?, ?)
  `;
  db.query(sql, [data.tokenId, data.name, data.qty, data.rate], callback);
};

const getTokenItems = (tokenId, callback) => {
  const sql = "SELECT * FROM token_items WHERE token_id=?";
  db.query(sql, [tokenId], callback);
};

const getTokenItemWithToken = (itemId, callback) => {
  const sql = `
    SELECT
      ti.*,
      t.id AS token_row_id,
      t.tableNumber,
      t.waiter,
      t.status AS token_status
    FROM token_items ti
    INNER JOIN tokens t ON t.id = ti.token_id
    WHERE ti.id = ?
    LIMIT 1
  `;
  db.query(sql, [itemId], (err, result) => {
    callback(err, result?.[0] || null);
  });
};

const updateTokenItem = (data, callback) => {
  const sql = `
    UPDATE token_items
    SET qty=?, rate=?
    WHERE id=?
  `;
  db.query(sql, [data.qty, data.rate, data.id], callback);
};

const deleteTokenItem = (id, callback) => {
  db.query("DELETE FROM token_items WHERE id=?", [id], callback);
};

const closeActiveToken = (tableNumber, callback) => {
  const sql = `
    UPDATE tokens
    SET status='closed'
    WHERE tableNumber=? AND status='active'
  `;
  db.query(sql, [tableNumber], callback);
};

module.exports = {
  ensureSchema,
  getActiveTokenByTable,
  createToken,
  getTokenByTable,
  getTokenById,
  addTokenItem,
  getTokenItems,
  getTokenItemWithToken,
  updateTokenItem,
  deleteTokenItem,
  closeActiveToken,
};
