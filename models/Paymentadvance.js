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

const addPayment = async (data, callback) => {
  try {
    await ensureSchema();
    // 🐛 FIX: this used to unconditionally INSERT a new row every time,
    // including when the user was just EDITING an existing advance (e.g.
    // changing Cash -> Card). Since advance_payment only ever keeps ONE row
    // per booking (booking_id is its PRIMARY KEY), payment_history should
    // mirror that — otherwise Accounts.jsx's transaction list (which shows
    // every payment_history row as a separate "Hotel payment received"
    // line) kept BOTH the stale old-mode entry and the new one, instead of
    // the edit replacing it with the corrected mode/amount.
    await runQuery("DELETE FROM payment_history WHERE booking_id = ?", [data.booking_id]);
    await runQuery(
      `INSERT INTO payment_history (booking_id, amount, discount_amount, payment_mode)
       VALUES (?, ?, ?, ?)`,
      [data.booking_id, data.amount, Number(data.discount || 0), data.paymentMode || "Cash"],
    );
    callback(null);
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  ensureSchema,
  addPayment,
};