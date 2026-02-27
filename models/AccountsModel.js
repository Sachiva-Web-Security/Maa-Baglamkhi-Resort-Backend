const db = require("../config/db");

const getTransactions = (callback) => {
  const sql =
    "SELECT id, DATE_FORMAT(date, '%d %b %Y') AS date, type, description, amount, payment_mode AS paymentMode FROM accounts_transactions ORDER BY date DESC, id DESC";
  db.query(sql, callback);
};

const createTransaction = (data, callback) => {
  const sql =
    "INSERT INTO accounts_transactions (date, type, description, amount, payment_mode) VALUES (?, ?, ?, ?, ?)";
  db.query(
    sql,
    [data.date, data.type, data.description, data.amount, data.paymentMode],
    callback
  );
};

module.exports = { getTransactions, createTransaction };

