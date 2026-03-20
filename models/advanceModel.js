const db = require("../config/db");

const addAdvance = (data, callback) => {
  const sql = `
    INSERT INTO advance_payment 
    (booking_id, amount, payment_mode, receipt_account, transaction_details, remarks)
    VALUES (?, ?, ?, ?, ?, ?)
    
    ON DUPLICATE KEY UPDATE
    amount = amount + VALUES(amount),
    payment_mode = VALUES(payment_mode)
  `;

  db.query(
    sql,
    [
      data.booking_id,
      data.amount,
      data.paymentMode,
      data.receiptAccount || null,
      data.transactionDetails || null,
      data.remarks || null
    ],
    callback
  );
};

module.exports = {
  addAdvance
};