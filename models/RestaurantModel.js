const db = require("../config/db");
const createBill = (billData, callback) => {
  const sql = `INSERT INTO restaurant_bills 
    (table_number, items_json, subtotal, gst, total, payment_method, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, NOW())`;

  db.query(
    sql,
    [
      billData.table,
      JSON.stringify(billData.items || []),
      billData.subtotal,
      billData.gst,
      billData.total,
      billData.paymentMethod,
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


const addItemToOrder = (orderId, item, callback) => {
  const sql = `INSERT INTO restaurant_order_items (order_id, item_name, price, quantity) VALUES (?, ?, ?, ?)`;
  db.query(sql, [orderId, item.name, item.price, item.quantity], callback);
};

const createOrder = (tableNumber, callback) => {
  const sql = `INSERT INTO restaurant_orders (table_number, status, created_at) VALUES (?, 'Pending', NOW())`;
  db.query(sql, [tableNumber], (err, result) => {
    if (err) return callback(err);
    callback(null, { id: result.insertId, table_number: tableNumber });
  });
};


const markOrderPaid = (orderId, callback) => {
  const sql = `UPDATE restaurant_orders SET status='Paid' WHERE id=?`;
  db.query(sql, [orderId], callback);
};

const getPendingOrder = (tableNumber, callback) => {
  const sqlOrder = `SELECT * FROM restaurant_orders WHERE table_number = ? AND status='Pending' ORDER BY id DESC LIMIT 1`;
  db.query(sqlOrder, [tableNumber], (err, orders) => {
    if (err) return callback(err);

    if (orders.length === 0) return callback(null, null); // no pending order

    const order = orders[0];

    // fetch order items
    const sqlItems = `SELECT * FROM restaurant_order_items WHERE order_id = ?`;
    db.query(sqlItems, [order.id], (err2, items) => {
      if (err2) return callback(err2);
      order.items = items;
      callback(null, order);
    });
  });
};



module.exports = {
  getPendingOrder,
  createOrder,
  addItemToOrder,
  getTables,
  addTable,
  createBill,
  markOrderPaid,
};