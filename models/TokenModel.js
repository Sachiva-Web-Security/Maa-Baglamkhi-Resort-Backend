const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const tableExists = async (tableName) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  try {
    const rows = await runQuery(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    return false;
  }
};

exports.ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS token_transfer_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token_id INT NOT NULL,
      token_code VARCHAR(100) NULL,
      source_type VARCHAR(50) NOT NULL,
      source_ref VARCHAR(100) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_ref VARCHAR(100) NOT NULL,
      transferred_by VARCHAR(120) DEFAULT 'System User',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_token_transfer_logs_token_id (token_id),
      INDEX idx_token_transfer_logs_created_at (created_at)
    )
  `);
};

const buildTokenCode = (tokenId) => `TK${String(tokenId).padStart(6, "0")}`;

exports.getActiveTokens = async () => {
  const hasCreatedAt = await columnExists("tokens", "created_at");
  const rows = await runQuery(
    `
      SELECT
        t.id,
        t.tableNumber,
        t.waiter,
        t.status,
        ${hasCreatedAt ? "t.created_at" : "NULL"} AS created_at,
        COUNT(ti.id) AS itemCount,
        COALESCE(SUM(COALESCE(ti.qty, 0) * COALESCE(ti.rate, 0)), 0) AS totalAmount
      FROM tokens t
      LEFT JOIN token_items ti ON ti.token_id = t.id
      WHERE t.status = 'active'
      GROUP BY t.id, t.tableNumber, t.waiter, t.status, ${hasCreatedAt ? "t.created_at" : "t.id"}
      ORDER BY t.id DESC
    `,
  );

  return rows.map((row) => ({
    ...row,
    tokenCode: buildTokenCode(row.id),
  }));
};

exports.getTransferHistory = async ({ startDate, endDate, search, limit = 15 }) => {
  await exports.ensureSchema();

  const conditions = [];
  const params = [];

  if (startDate) {
    conditions.push("DATE(created_at) >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("DATE(created_at) <= ?");
    params.push(endDate);
  }
  if (search) {
    conditions.push("(token_code LIKE ? OR source_ref LIKE ? OR target_ref LIKE ? OR transferred_by LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const safeLimit = Math.max(1, Math.min(Number(limit) || 15, 100));
  const rows = await runQuery(
    `
      SELECT
        id,
        token_id,
        token_code,
        source_type,
        source_ref,
        target_type,
        target_ref,
        transferred_by,
        notes,
        created_at
      FROM token_transfer_logs
      ${whereClause}
      ORDER BY id DESC
      LIMIT ${safeLimit}
    `,
    params,
  );

  return rows;
};

exports.transferToken = ({ tokenId, sourceType, sourceRef, targetType, targetRef, transferredBy, notes }) =>
  new Promise((resolve, reject) => {
    db.beginTransaction((txError) => {
      if (txError) {
        return reject(txError);
      }

      db.query(
        "SELECT * FROM tokens WHERE id = ? AND status = 'active' LIMIT 1",
        [tokenId],
        (tokenError, tokenRows) => {
          if (tokenError) {
            return db.rollback(() => reject(tokenError));
          }

          const token = tokenRows?.[0];
          if (!token) {
            return db.rollback(() => reject(new Error("Active token not found")));
          }

          db.query(
            "SELECT id FROM tokens WHERE tableNumber = ? AND status = 'active' AND id <> ? LIMIT 1",
            [targetRef, tokenId],
            (existingError, existingRows) => {
              if (existingError) {
                return db.rollback(() => reject(existingError));
              }

              if (existingRows?.length) {
                return db.rollback(() => reject(new Error("Target already has an active token")));
              }

              db.query(
                "UPDATE tokens SET tableNumber = ? WHERE id = ?",
                [targetRef, tokenId],
                (updateTokenError) => {
                  if (updateTokenError) {
                    return db.rollback(() => reject(updateTokenError));
                  }

                  db.query(
                    "UPDATE orders SET tableNumber = ? WHERE tableNumber = ? AND status = 'pending'",
                    [targetRef, sourceRef],
                    (updateOrderError) => {
                      if (updateOrderError) {
                        return db.rollback(() => reject(updateOrderError));
                      }

                      db.query(
                        `
                          INSERT INTO token_transfer_logs
                          (token_id, token_code, source_type, source_ref, target_type, target_ref, transferred_by, notes)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        [
                          tokenId,
                          buildTokenCode(tokenId),
                          sourceType,
                          sourceRef,
                          targetType,
                          targetRef,
                          transferredBy || "System User",
                          notes || null,
                        ],
                        (insertError, insertResult) => {
                          if (insertError) {
                            return db.rollback(() => reject(insertError));
                          }

                          db.commit((commitError) => {
                            if (commitError) {
                              return db.rollback(() => reject(commitError));
                            }

                            resolve({
                              id: insertResult.insertId,
                              tokenId,
                              tokenCode: buildTokenCode(tokenId),
                              sourceType,
                              sourceRef,
                              targetType,
                              targetRef,
                              transferredBy: transferredBy || "System User",
                            });
                          });
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        },
      );
    });
  });

// CREATE TOKEN
exports.createToken = (data, callback) => {
  const sql = `
    INSERT INTO tokens (tableNumber, waiter, status)
    VALUES (?, ?, 'active')
  `;
  db.query(sql, [data.tableNumber, data.waiter], callback);
};

// GET TOKEN BY TABLE
exports.getTokenByTable = (table, callback) => {
  const sql = `
    SELECT * FROM tokens
    WHERE tableNumber = ? AND status='active'
  `;
  db.query(sql, [table], (err, result) => {
    callback(err, result[0]);
  });
};

// ADD TOKEN ITEM
exports.addTokenItem = (data, callback) => {
  const sql = `
    INSERT INTO token_items (token_id, item_name, qty, rate)
    VALUES (?, ?, ?, ?)
  `;
  db.query(
    sql,
    [data.tokenId, data.name, data.qty, data.rate],
    callback
  );
};

// GET TOKEN ITEMS
exports.getTokenItems = (tokenId, callback) => {
  const sql = `
    SELECT * FROM token_items WHERE token_id=?
  `;
  db.query(sql, [tokenId], callback);
};

// UPDATE TOKEN ITEM
exports.updateTokenItem = (data, callback) => {
  const sql = `
    UPDATE token_items
    SET qty=?, rate=?
    WHERE id=?
  `;
  db.query(sql, [data.qty, data.rate, data.id], callback);
};

// DELETE ITEM
exports.deleteTokenItem = (id, callback) => {
  db.query("DELETE FROM token_items WHERE id=?", [id], callback);
};

// CLOSE ACTIVE TOKEN FOR TABLE
exports.closeActiveToken = (tableNumber, callback) => {
  const sql = `
    UPDATE tokens
    SET status='closed'
    WHERE tableNumber=? AND status='active'
  `;
  db.query(sql, [tableNumber], callback);
};
