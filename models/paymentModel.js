const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tableNumber VARCHAR(50) DEFAULT NULL,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      paymentMethod VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const createPayment = (data, callback) => {
  const sql = `
    INSERT INTO payments (tableNumber,total,paymentMethod)
    VALUES (?,?,?)
  `;

  db.query(sql, [data.table, data.total, data.method], callback);
};

const getPayments = (callback) => {
  db.query("SELECT * FROM payments ORDER BY id DESC", callback);
};

module.exports = {
  ensureSchema,
  createPayment,
  getPayments,
};
