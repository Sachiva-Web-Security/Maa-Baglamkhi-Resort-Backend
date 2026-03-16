const db = require("../config/db");

/* ================= TABLES ================= */

exports.addTable = (data, callback) => {
  const sql = "INSERT INTO tables (number) VALUES (?)";
  db.query(sql, [data.number], callback);
};

exports.getTables = (callback) => {
  db.query("SELECT * FROM tables ORDER BY id DESC", callback);
};

/* ================= MENU ================= */

exports.addMenuItem = (data, callback) => {
  const sql =
    "INSERT INTO menu_items (name, price, category, table_number) VALUES (?,?,?,?)";

  db.query(
    sql,
    [data.name, data.price, data.category, data.tableNumber],
    callback
  );
};

exports.getMenuItems = (filters, callback) => {
  let sql = "SELECT * FROM menu_items";
  let params = [];

  if (filters.tableNumber) {
    sql += " WHERE table_number=?";
    params.push(filters.tableNumber);
  }

  sql += " ORDER BY id DESC";

  db.query(sql, params, callback);
};

/* ================= ORDERS ================= */

exports.createOrder = (tableNumber, callback) => {
  db.query("INSERT INTO orders (tableNumber) VALUES (?)", [tableNumber], callback);
};

exports.getPendingOrder = (tableNumber, callback) => {
  const sql =
    "SELECT * FROM orders WHERE tableNumber=? AND status='pending'";

  db.query(sql, [tableNumber], (err, rows) => {
    callback(err, rows[0]);
  });
};

exports.addItemToOrder = (orderId, item, callback) => {
  const sql =
    "INSERT INTO order_items (order_id,name,price,quantity) VALUES (?,?,?,?)";

  db.query(
    sql,
    [orderId, item.name, item.price, item.quantity || 1],
    callback
  );
};


exports.getOrderItems = (orderId, callback) => {
  const sql = "SELECT * FROM order_items WHERE order_id=?";

  db.query(sql, [orderId], callback);
};


/* ================= BILL ================= */

exports.createBill = (data, callback) => {
  const sql = `
    INSERT INTO bills
    (tableNumber, subtotal, gst, total, paymentMethod)
    VALUES (?,?,?,?,?)
  `;

  db.query(
    sql,
    [data.table, data.subtotal, data.gst, data.total, data.paymentMethod],
    callback
  );
};

exports.markOrderPaid = (orderId, callback) => {
  db.query("UPDATE orders SET status='paid' WHERE id=?", [orderId], callback);
};