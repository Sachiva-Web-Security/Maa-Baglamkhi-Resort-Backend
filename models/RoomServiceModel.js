const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

exports.ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_service_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_number VARCHAR(50) NOT NULL,
      token_id INT DEFAULT NULL,
      status VARCHAR(30) DEFAULT 'pending',
      total DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_number VARCHAR(50) NOT NULL UNIQUE,
      status VARCHAR(60) DEFAULT 'Available',
      guest VARCHAR(191) DEFAULT NULL,
      check_in DATE DEFAULT NULL,
      check_out DATE DEFAULT NULL
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_menu_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      category VARCHAR(100) DEFAULT 'Other'
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roomNumber VARCHAR(50) NOT NULL,
      status VARCHAR(30) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      name VARCHAR(191) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      quantity INT NOT NULL DEFAULT 1
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roomNumber VARCHAR(50) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      paymentMethod VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

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
