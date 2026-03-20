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
    CREATE TABLE IF NOT EXISTS advance_payment (
      booking_id INT PRIMARY KEY,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_mode VARCHAR(100) DEFAULT 'Cash',
      receipt_account VARCHAR(150) NULL,
      transaction_details TEXT NULL,
      remarks TEXT NULL,
      refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `);

  const columns = await runQuery("SHOW COLUMNS FROM advance_payment LIKE 'discount_amount'");

  if (!columns.length) {
    await runQuery(`
      ALTER TABLE advance_payment
      ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount
    `);
  }
};

const addAdvance = (data, callback) => {
  const sql = `
    INSERT INTO advance_payment 
    (booking_id, amount, discount_amount, payment_mode, receipt_account, transaction_details, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    
    ON DUPLICATE KEY UPDATE
    amount = amount + VALUES(amount),
    discount_amount = IFNULL(discount_amount, 0) + VALUES(discount_amount),
    payment_mode = VALUES(payment_mode),
    remarks = COALESCE(VALUES(remarks), remarks)
  `;

  db.query(
    sql,
    [
      data.booking_id,
      data.amount,
      Number(data.discount || 0),
      data.paymentMode,
      data.receiptAccount || null,
      data.transactionDetails || null,
      data.remarks || null
    ],
    callback
  );
};

module.exports = {
  ensureSchema,
  addAdvance
};
