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

const addTable = (data, callback) => {
  const sql =
    "INSERT INTO restaurant_tables (number, status, guestCount) VALUES (?, ?, ?)";

  db.query(sql, [data.number, data.status, data.guestCount], callback);
};

const getTables = (callback) => {
  const sql = "SELECT * FROM restaurant_tables ORDER BY id DESC";
  db.query(sql, callback);
};

module.exports = {
  createBill,
  addTable,
  getTables,
};