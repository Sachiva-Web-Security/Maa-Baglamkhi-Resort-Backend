const db = require("../config/db");

/* ================= ROOMS ================= */

exports.addRoom = (data, callback) => {
  // Table uses column `room_number` in the rest of the codebase; use it for compatibility
  const sql = "INSERT INTO rooms (room_number) VALUES (?)";
  db.query(sql, [data.number], callback);
};

exports.getRooms = (callback) => {
  // Map to common shape: id, number, status
  const sql =
    "SELECT id, room_number AS number, status FROM rooms ORDER BY id DESC";
  db.query(sql, callback);
};

/* ================= MENU ================= */

exports.addMenuItem = (data, callback) => {
  const sql = `
    INSERT INTO room_menu_items (name, price, category)
    VALUES (?,?,?)
  `;

  db.query(sql, [data.name, data.price, data.category], callback);
};

exports.getMenuItems = (callback) => {
  const sql = "SELECT * FROM room_menu_items ORDER BY id DESC";
  db.query(sql, callback);
};

/* ================= ORDERS ================= */

exports.createOrder = (roomNumber, callback) => {
  db.query("INSERT INTO room_orders (roomNumber) VALUES (?)", [roomNumber], callback);
};

exports.getPendingOrder = (roomNumber, callback) => {
  const sql =
    "SELECT * FROM room_orders WHERE roomNumber=? AND status='pending'";

  db.query(sql, [roomNumber], (err, rows) => {
    callback(err, rows[0]);
  });
};

exports.addItemToOrder = (orderId, item, callback) => {
  const sql = `
    INSERT INTO room_order_items (order_id, name, price, quantity)
    VALUES (?,?,?,?)
  `;

  const qty = item.quantity ?? item.qty ?? 1;
  db.query(sql, [orderId, item.name, item.price, qty], callback);
};

exports.getOrderItems = (orderId, callback) => {
  const sql = "SELECT * FROM room_order_items WHERE order_id=?";
  db.query(sql, [orderId], callback);
};

exports.getOrderWithItemsByRoom = (roomNumber, callback) => {
  const sqlOrder = "SELECT * FROM room_orders WHERE roomNumber=? AND status='pending'";
  db.query(sqlOrder, [roomNumber], (err, orders) => {
    if (err) return callback(err);
    const order = orders?.[0];
    if (!order) return callback(null, null);
    const sqlItems = "SELECT * FROM room_order_items WHERE order_id=?";
    db.query(sqlItems, [order.id], (err2, items) => {
      if (err2) return callback(err2);
      callback(null, { order, items });
    });
  });
};

/* ================= BILL ================= */

exports.createBill = (data, callback) => {
  const sql = `
    INSERT INTO room_bills
    (roomNumber, subtotal, gst, total, paymentMethod)
    VALUES (?,?,?,?,?)
  `;

  db.query(
    sql,
    [data.roomNumber, data.subtotal, data.gst, data.total, data.paymentMethod],
    callback
  );
};

exports.markOrderPaid = (orderId, callback) => {
  db.query("UPDATE room_orders SET status='paid' WHERE id=?", [orderId], callback);
};

exports.updateOrderStatus = (orderId, status, callback) => {
  db.query("UPDATE room_orders SET status=? WHERE id=?", [status, orderId], callback);
};
