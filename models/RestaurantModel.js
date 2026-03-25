const db = require("../config/db");
const connection = db.promise();

const run = (sql, params = []) => connection.query(sql, params);

const ensureSchema = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      number VARCHAR(50) NOT NULL UNIQUE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      category VARCHAR(120) DEFAULT 'Other',
      table_number VARCHAR(50) DEFAULT NULL,
      image_url VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const imageColumn = await run("SHOW COLUMNS FROM menu_items LIKE 'image_url'");
  if (!imageColumn.length) {
    await run("ALTER TABLE menu_items ADD COLUMN image_url VARCHAR(255) DEFAULT NULL AFTER table_number");
  }

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tableNumber VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      name VARCHAR(191) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      quantity INT NOT NULL DEFAULT 1,
      CONSTRAINT fk_order_items_order
      FOREIGN KEY (order_id) REFERENCES orders(id)
      ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tableNumber VARCHAR(50) NOT NULL,
      entityType VARCHAR(30) DEFAULT 'Table',
      customerName VARCHAR(191) DEFAULT NULL,
      phone VARCHAR(30) DEFAULT NULL,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      paymentMethod VARCHAR(50) DEFAULT NULL,
      invoiceStatus VARCHAR(50) DEFAULT 'Saved',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [customerNameColumn] = await run("SHOW COLUMNS FROM bills LIKE 'customerName'");
  if (!customerNameColumn.length) {
    await run("ALTER TABLE bills ADD COLUMN customerName VARCHAR(191) DEFAULT NULL AFTER tableNumber");
  }

  const [entityTypeColumn] = await run("SHOW COLUMNS FROM bills LIKE 'entityType'");
  if (!entityTypeColumn.length) {
    await run("ALTER TABLE bills ADD COLUMN entityType VARCHAR(30) DEFAULT 'Table' AFTER tableNumber");
  }

  const [phoneColumn] = await run("SHOW COLUMNS FROM bills LIKE 'phone'");
  if (!phoneColumn.length) {
    await run("ALTER TABLE bills ADD COLUMN phone VARCHAR(30) DEFAULT NULL AFTER customerName");
  }

  const [invoiceStatusColumn] = await run("SHOW COLUMNS FROM bills LIKE 'invoiceStatus'");
  if (!invoiceStatusColumn.length) {
    await run("ALTER TABLE bills ADD COLUMN invoiceStatus VARCHAR(50) DEFAULT 'Saved' AFTER paymentMethod");
  }
};

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
    "INSERT INTO menu_items (name, price, category, table_number, image_url) VALUES (?,?,?,?,?)";

  db.query(
    sql,
    [data.name, data.price, data.category, data.tableNumber, data.imageUrl || null],
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
    (tableNumber, entityType, customerName, phone, subtotal, gst, total, paymentMethod, invoiceStatus)
    VALUES (?,?,?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [
      data.table,
      data.entityType || "Table",
      data.customerName || null,
      data.phone || null,
      data.subtotal,
      data.gst,
      data.total,
      data.paymentMethod,
      data.invoiceStatus || "Saved",
    ],
    callback
  );
};

exports.getBills = (callback) => {
  db.query(
    `
      SELECT
        id,
        tableNumber,
        entityType,
        customerName,
        phone,
        subtotal,
        gst,
        total,
        paymentMethod,
        invoiceStatus,
        created_at
      FROM bills
      ORDER BY id DESC
      LIMIT 100
    `,
    callback,
  );
};

exports.markOrderPaid = (orderId, callback) => {
  db.query("UPDATE orders SET status='paid' WHERE id=?", [orderId], callback);
};

module.exports = {
  ensureSchema,
  addTable: exports.addTable,
  getTables: exports.getTables,
  addMenuItem: exports.addMenuItem,
  getMenuItems: exports.getMenuItems,
  createOrder: exports.createOrder,
  getPendingOrder: exports.getPendingOrder,
  addItemToOrder: exports.addItemToOrder,
  getOrderItems: exports.getOrderItems,
  createBill: exports.createBill,
  getBills: exports.getBills,
  markOrderPaid: exports.markOrderPaid,
};
