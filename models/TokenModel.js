const db = require("../config/db");

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