const db = require("../config/db");

const addAdvance = (data, callback) => {

  const sql = `
  INSERT INTO advance_payment
  (guest_id, amount, payment_mode, receipt_account, transaction_details, remarks)
  VALUES (?,?,?,?,?,?)
  `;

  db.query(sql,[
    data.booking_id,
    data.amount,
    data.paymentMode,
    data.receiptAccount,
    data.transactionDetails,
    data.remarks
  ],callback)

}

module.exports = {
  addAdvance
};