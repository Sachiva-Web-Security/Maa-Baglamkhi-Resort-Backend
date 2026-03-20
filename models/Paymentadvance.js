const db = require("../config/db");

const addPayment = (data, callback) => {
  const sql = `
    INSERT INTO payment_history (booking_id, amount, payment_mode)
    VALUES (?, ?, ?)
  `;

  db.query(
    sql,
    [
      data.booking_id,
      data.amount,
      data.paymentMode || "Cash"
    ],
    callback
  );
};

module.exports = {
  addPayment,
};