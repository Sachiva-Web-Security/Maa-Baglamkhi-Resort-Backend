const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS accounts_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      type ENUM('Income','Expense') NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_mode VARCHAR(30) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

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
    callback,
  );
};

const getSummary = (callback) => {
  const sql = `
    SELECT
      SUM(CASE WHEN type='Income' THEN amount ELSE 0 END) AS totalIncome,
      SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END) AS totalExpense
    FROM accounts_transactions
  `;
  db.query(sql, callback);
};

module.exports = {
  ensureSchema,
  getTransactions,
  createTransaction,
  getSummary,
};
