const db = require("../config/db");

exports.createPayment = (data, callback) => {
  const sql = `
    INSERT INTO payments (tableNumber,total,paymentMethod)
    VALUES (?,?,?)
  `;

  db.query(
    sql,
    [data.table, data.total, data.method],
    callback
  );
};

exports.getPayments = (callback) => {
  db.query("SELECT * FROM payments ORDER BY id DESC", callback);
};