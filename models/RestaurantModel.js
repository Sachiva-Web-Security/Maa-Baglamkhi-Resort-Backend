const db = require("../config/db");

exports.addTable = (data, callback) => {
    const sql = "INSERT INTO tables (number) VALUES (?)";
    db.query(sql, [data.number], callback);
};

exports.getTables = (callback) => {
    db.query("SELECT * FROM tables", callback);
};

exports.addMenuItem = (data, callback) => {
    const sql = "INSERT INTO menu_items (name, price, category) VALUES (?,?,?)";
    db.query(sql, [data.name, data.price, data.category], callback);
};

exports.getMenuItems = (callback) => {
    db.query("SELECT * FROM menu_items", callback);
};

exports.createOrder = (tableNumber, callback) => {
    db.query("INSERT INTO orders (tableNumber) VALUES (?)", [tableNumber], callback);
};

exports.getPendingOrder = (tableNumber, callback) => {
    const sql = "SELECT * FROM orders WHERE tableNumber=? AND status='pending'";
    db.query(sql, [tableNumber], (err, results) => {
        callback(err, results[0]);
    });
};

exports.addItemToOrder = (orderId, item, callback) => {
    const sql =
        "INSERT INTO order_items (order_id, name, price, quantity) VALUES (?,?,?,?)";

    db.query(sql, [orderId, item.name, item.price, item.quantity || 1], callback);
};

exports.createBill = (data, callback) => {
    const sql = `
    INSERT INTO bills (tableNumber, subtotal, gst, total, paymentMethod)
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