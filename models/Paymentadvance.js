const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS payment_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_mode VARCHAR(100) DEFAULT 'Cash',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = await runQuery("SHOW COLUMNS FROM payment_history LIKE 'discount_amount'");

  if (!columns.length) {
    await runQuery(`
      ALTER TABLE payment_history
      ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount
    `);
  }

  // Ensure updated_at exists for audit / edit operations
  const hasUpdatedAt = await runQuery("SHOW COLUMNS FROM payment_history LIKE 'updated_at'");
  if (!hasUpdatedAt.length) {
    await runQuery(`
      ALTER TABLE payment_history
      ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
    `);
  }
};

const addPayment = (data, callback) => {
  const sql = `
    INSERT INTO payment_history (booking_id, amount, discount_amount, payment_mode)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      data.booking_id,
      data.amount,
      Number(data.discount || 0),
      data.paymentMode || "Cash"
    ],
    callback
  );
};

module.exports = {
  ensureSchema,
  addPayment,
};
