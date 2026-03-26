const db = require("../config/db");
const connection = db.promise();

const run = (sql, params = []) => connection.query(sql, params);

const ensureColumn = async (tableName, columnName, definition) => {
  const [rows] = await run(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (!rows.length) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

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
      tax DECIMAL(6,2) NOT NULL DEFAULT 5,
      happy_hour_price DECIMAL(10,2) DEFAULT NULL,
      happy_hour_start TIME DEFAULT NULL,
      happy_hour_end TIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("tables", "floor_name", "VARCHAR(80) DEFAULT NULL AFTER number");
  await ensureColumn("tables", "section_name", "VARCHAR(80) DEFAULT NULL AFTER floor_name");
  await ensureColumn("tables", "seat_count", "INT NOT NULL DEFAULT 4 AFTER section_name");
  await ensureColumn("tables", "status_color", "VARCHAR(30) DEFAULT NULL AFTER seat_count");

  await ensureColumn("menu_items", "image_url", "VARCHAR(255) DEFAULT NULL AFTER table_number");
  await ensureColumn("menu_items", "tax", "DECIMAL(6,2) NOT NULL DEFAULT 5 AFTER image_url");
  await ensureColumn("menu_items", "happy_hour_price", "DECIMAL(10,2) DEFAULT NULL AFTER tax");
  await ensureColumn("menu_items", "happy_hour_start", "TIME DEFAULT NULL AFTER happy_hour_price");
  await ensureColumn("menu_items", "happy_hour_end", "TIME DEFAULT NULL AFTER happy_hour_start");

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

  await ensureColumn("bills", "customerName", "VARCHAR(191) DEFAULT NULL AFTER tableNumber");
  await ensureColumn("bills", "entityType", "VARCHAR(30) DEFAULT 'Table' AFTER tableNumber");
  await ensureColumn("bills", "phone", "VARCHAR(30) DEFAULT NULL AFTER customerName");
  await ensureColumn("bills", "invoiceStatus", "VARCHAR(50) DEFAULT 'Saved' AFTER paymentMethod");
  await ensureColumn("bills", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER entityType");
  await ensureColumn("bills", "split_no", "INT DEFAULT NULL AFTER invoiceStatus");
  await ensureColumn("bills", "split_count", "INT DEFAULT NULL AFTER split_no");

  await run(`
    CREATE TABLE IF NOT EXISTS restaurant_item_action_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token_item_id INT NOT NULL,
      table_number VARCHAR(50) NOT NULL,
      action_type VARCHAR(30) NOT NULL,
      reason TEXT NOT NULL,
      requested_by VARCHAR(191) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Pending',
      manager_note TEXT DEFAULT NULL,
      approved_by VARCHAR(191) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS restaurant_split_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT DEFAULT NULL,
      table_number VARCHAR(50) NOT NULL,
      entity_type VARCHAR(30) DEFAULT 'Table',
      split_label VARCHAR(80) NOT NULL,
      split_no INT NOT NULL,
      split_count INT NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT NULL,
      items_json LONGTEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

/* ================= TABLES ================= */

exports.addTable = (data, callback) => {
  const sql = `
    INSERT INTO tables (number, floor_name, section_name, seat_count, status_color)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(
    sql,
    [
      data.number,
      data.floorName || null,
      data.sectionName || null,
      Number(data.seatCount || 4),
      data.statusColor || null,
    ],
    callback,
  );
};

exports.getTables = (callback) => {
  db.query("SELECT * FROM tables ORDER BY floor_name ASC, section_name ASC, number ASC", callback);
};

/* ================= MENU ================= */

exports.addMenuItem = (data, callback) => {
  const sql =
    "INSERT INTO menu_items (name, price, category, table_number, image_url, tax, happy_hour_price, happy_hour_start, happy_hour_end) VALUES (?,?,?,?,?,?,?,?,?)";

  db.query(
    sql,
    [
      data.name,
      data.price,
      data.category,
      data.tableNumber,
      data.imageUrl || null,
      Number(data.tax || 5),
      data.happyHourPrice != null && data.happyHourPrice !== "" ? Number(data.happyHourPrice) : null,
      data.happyHourStart || null,
      data.happyHourEnd || null,
    ],
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
  const resolvedWaiterName =
    String(data.waiterName || "").trim() ||
    (String(data.entityType || "Table").toLowerCase() === "room" ? "Room Service" : "Waiter");
  const sql = `
    INSERT INTO bills
    (tableNumber, entityType, waiter_name, customerName, phone, subtotal, gst, total, paymentMethod, invoiceStatus, split_no, split_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [
      data.table,
      data.entityType || "Table",
      resolvedWaiterName,
      data.customerName || null,
      data.phone || null,
      data.subtotal,
      data.gst,
      data.total,
      data.paymentMethod,
      data.invoiceStatus || "Saved",
      data.splitNo || null,
      data.splitCount || null,
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
        waiter_name,
        customerName,
        phone,
        subtotal,
        gst,
        total,
        paymentMethod,
        invoiceStatus,
        split_no,
        split_count,
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

exports.addItemActionRequest = (data, callback) => {
  const sql = `
    INSERT INTO restaurant_item_action_requests
    (token_item_id, table_number, action_type, reason, requested_by, status)
    VALUES (?, ?, ?, ?, ?, 'Pending')
  `;
  db.query(
    sql,
    [data.tokenItemId, data.tableNumber, data.actionType, data.reason, data.requestedBy || null],
    callback,
  );
};

exports.getItemActionRequests = (callback) => {
  db.query(
    `
      SELECT *
      FROM restaurant_item_action_requests
      ORDER BY created_at DESC, id DESC
    `,
    callback,
  );
};

exports.updateItemActionRequestStatus = (id, data, callback) => {
  const sql = `
    UPDATE restaurant_item_action_requests
    SET status=?, manager_note=?, approved_by=?
    WHERE id=?
  `;
  db.query(sql, [data.status, data.managerNote || null, data.approvedBy || null, id], callback);
};

exports.createSplitBill = (data, callback) => {
  const sql = `
    INSERT INTO restaurant_split_bills
    (bill_id, table_number, entity_type, split_label, split_no, split_count, subtotal, gst, total, payment_method, items_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(
    sql,
    [
      data.billId || null,
      data.tableNumber,
      data.entityType || "Table",
      data.splitLabel,
      data.splitNo,
      data.splitCount,
      data.subtotal,
      data.gst,
      data.total,
      data.paymentMethod || null,
      data.itemsJson || null,
    ],
    callback,
  );
};

exports.getWaiterPerformance = (callback) => {
  db.query(
    `
      SELECT
        COALESCE(NULLIF(TRIM(waiter_name), ''), 'Waiter') AS waiterName,
        COUNT(*) AS billsHandled,
        COALESCE(SUM(total), 0) AS salesTotal,
        COALESCE(AVG(total), 0) AS avgBillValue
      FROM bills
      GROUP BY COALESCE(NULLIF(TRIM(waiter_name), ''), 'Waiter')
      ORDER BY salesTotal DESC, billsHandled DESC
    `,
    callback,
  );
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
  addItemActionRequest: exports.addItemActionRequest,
  getItemActionRequests: exports.getItemActionRequests,
  updateItemActionRequestStatus: exports.updateItemActionRequestStatus,
  createSplitBill: exports.createSplitBill,
  getWaiterPerformance: exports.getWaiterPerformance,
};
