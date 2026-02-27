const db = require("../config/db");

const createBill = (data, callback) => {
  const sql =
    "INSERT INTO restaurant_bills (table_number, items_json, subtotal, gst, total, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
  db.query(
    sql,
    [
      data.table,
      JSON.stringify(data.items || []),
      data.subtotal,
      data.gst,
      data.total,
      data.paymentMethod,
    ],
    callback
  );
};

module.exports = {
  createBill,
};

