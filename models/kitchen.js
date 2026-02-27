const db = require("../config/db");

const createOrder = (data, callback) => {
  const sql = "INSERT INTO kitchen_orders SET ?";
  db.query(sql, data, callback);
};

const getOrders = (callback) => {
  const sql = "SELECT * FROM kitchen_orders ORDER BY id DESC";
  db.query(sql, callback);
};

const updateOrderStatus = (id, status, callback) => {
  const sql = "UPDATE kitchen_orders SET status=? WHERE id=?";
  db.query(sql, [status, id], callback);
};

module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus,
};