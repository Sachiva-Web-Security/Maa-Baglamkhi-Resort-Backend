const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

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
};

const createToken = (data, callback) => {
  const sql = `
    INSERT INTO tokens (tableNumber, waiter, status)
    VALUES (?, ?, 'active')
  `;
  db.query(sql, [data.tableNumber, data.waiter], callback);
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
  createToken,
  getTokenByTable,
  addTokenItem,
  getTokenItems,
  updateTokenItem,
  deleteTokenItem,
  closeActiveToken,
};
