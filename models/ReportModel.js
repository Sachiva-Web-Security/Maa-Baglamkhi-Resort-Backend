const db = require("../config/db");

// DAYWISE REPORT
exports.daywiseReport = (start, end, callback) => {
  const sql = `
  SELECT DATE(created_at) as date,
  SUM(total) as total
  FROM payments
  WHERE DATE(created_at) BETWEEN ? AND ?
  GROUP BY DATE(created_at)
  `;

  db.query(sql, [start, end], callback);
};

// ITEM CONSUMPTION
exports.itemConsumption = (callback) => {
  const sql = `
  SELECT item_name,
  SUM(qty) as quantity
  FROM token_items
  GROUP BY item_name
  `;

  db.query(sql, callback);
};