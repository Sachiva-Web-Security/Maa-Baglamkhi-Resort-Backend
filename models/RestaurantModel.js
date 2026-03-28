const db = require("../config/db");
const connection = db.promise();
const TABLES_TABLE = "restaurant_tables";

const run = (sql, params = []) => connection.query(sql, params);

const ensureColumn = async (tableName, columnName, definition) => {
  const [rows] = await run(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (!rows.length) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureIndex = async (tableName, indexName, definition) => {
  const [rows] = await run(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (!rows.length) {
    await run(`ALTER TABLE ${tableName} ADD ${definition}`);
  }
};

const ensureSchema = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS ${TABLES_TABLE} (
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

  await ensureColumn(TABLES_TABLE, "status", "VARCHAR(50) DEFAULT 'available' AFTER number");
  await ensureColumn(TABLES_TABLE, "guestCount", "INT DEFAULT 4 AFTER status");
  await ensureColumn(TABLES_TABLE, "floor_name", "VARCHAR(80) DEFAULT NULL AFTER guestCount");
  await ensureColumn(TABLES_TABLE, "section_name", "VARCHAR(80) DEFAULT NULL AFTER floor_name");
  await ensureColumn(TABLES_TABLE, "seat_count", "INT NOT NULL DEFAULT 4 AFTER section_name");
  await ensureColumn(TABLES_TABLE, "status_color", "VARCHAR(30) DEFAULT NULL AFTER seat_count");

  await ensureColumn("menu_items", "image_url", "VARCHAR(255) DEFAULT NULL AFTER table_number");
  await ensureColumn("menu_items", "tax", "DECIMAL(6,2) NOT NULL DEFAULT 5 AFTER image_url");
  await ensureColumn("menu_items", "description", "TEXT DEFAULT NULL AFTER image_url");
  await ensureColumn("menu_items", "food_type", "VARCHAR(30) DEFAULT 'Veg' AFTER description");
  await ensureColumn("menu_items", "status", "VARCHAR(40) DEFAULT 'Available' AFTER food_type");
  await ensureColumn("menu_items", "availability_status", "VARCHAR(40) DEFAULT 'Available' AFTER food_type");
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
  await ensureColumn("bills", "token_id", "INT DEFAULT NULL AFTER tableNumber");
  await ensureColumn("bills", "entityType", "VARCHAR(30) DEFAULT 'Table' AFTER tableNumber");
  await ensureColumn("bills", "phone", "VARCHAR(30) DEFAULT NULL AFTER customerName");
  await ensureColumn("bills", "invoiceStatus", "VARCHAR(50) DEFAULT 'Saved' AFTER paymentMethod");
  await ensureColumn("bills", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER entityType");
  await ensureColumn("bills", "split_no", "INT DEFAULT NULL AFTER invoiceStatus");
  await ensureColumn("bills", "split_count", "INT DEFAULT NULL AFTER split_no");
  await ensureColumn("bills", "discountAmount", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total");
  await ensureColumn("bills", "paid_at", "DATETIME DEFAULT NULL AFTER split_count");
  await ensureColumn("bills", "payment_id", "INT DEFAULT NULL AFTER paid_at");
  await ensureColumn("bills", "account_transaction_id", "INT DEFAULT NULL AFTER payment_id");
  await ensureIndex("bills", "uniq_bills_token_id", "UNIQUE KEY uniq_bills_token_id (token_id)");

  await run(`
    CREATE TABLE IF NOT EXISTS restaurant_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tableNumber VARCHAR(50) DEFAULT NULL,
      tokenId INT DEFAULT NULL,
      entityType VARCHAR(30) DEFAULT 'Table',
      subtotal DECIMAL(10,2) DEFAULT 0,
      gst DECIMAL(10,2) DEFAULT 0,
      discount DECIMAL(10,2) DEFAULT 0,
      total DECIMAL(10,2) DEFAULT 0,
      paymentMethod VARCHAR(50) DEFAULT NULL,
      invoiceStatus VARCHAR(30) DEFAULT 'unpaid',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
    INSERT INTO ${TABLES_TABLE} (number, guestCount, floor_name, section_name, seat_count, status_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(
    sql,
    [
      data.number,
      Number(data.seatCount || 4),
      data.floorName || null,
      data.sectionName || null,
      Number(data.seatCount || 4),
      data.statusColor || null,
    ],
    callback,
  );
};

exports.getTables = (callback) => {
  db.query(`SELECT * FROM ${TABLES_TABLE} ORDER BY floor_name ASC, section_name ASC, number ASC`, callback);
};

exports.updateTable = (id, data, callback) => {
  const sql = `
    UPDATE ${TABLES_TABLE}
    SET guestCount = ?, floor_name = ?, section_name = ?, seat_count = ?, status_color = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      Number(data.seatCount || 0) || 1,
      data.floorName || null,
      data.sectionName || null,
      Number(data.seatCount || 0) || 1,
      data.statusColor || null,
      id,
    ],
    callback,
  );
};

exports.deleteTable = async (id, callback) => {
  try {
    const [tableRows] = await run(`SELECT id, number FROM ${TABLES_TABLE} WHERE id = ? LIMIT 1`, [id]);
    const tableRow = tableRows?.[0];

    if (!tableRow) {
      const error = new Error("Table not found");
      error.statusCode = 404;
      throw error;
    }

    const tableNumber = String(tableRow.number || "").trim();

    const [activeTokens] = await run(
      "SELECT id FROM tokens WHERE tableNumber = ? AND status = 'active' LIMIT 1",
      [tableNumber],
    );
    if (activeTokens?.length) {
      const error = new Error("Active token wali table remove nahi ho sakti.");
      error.statusCode = 409;
      throw error;
    }

    const [pendingOrders] = await run(
      "SELECT id FROM orders WHERE tableNumber = ? AND status = 'pending' LIMIT 1",
      [tableNumber],
    );
    if (pendingOrders?.length) {
      const error = new Error("Pending order wali table remove nahi ho sakti.");
      error.statusCode = 409;
      throw error;
    }

    const [pendingBills] = await run(
      "SELECT id FROM bills WHERE tableNumber = ? AND COALESCE(invoiceStatus, 'Saved') <> 'Paid' LIMIT 1",
      [tableNumber],
    );
    if (pendingBills?.length) {
      const error = new Error("Pending bill wali table remove nahi ho sakti.");
      error.statusCode = 409;
      throw error;
    }

    await run(`DELETE FROM ${TABLES_TABLE} WHERE id = ?`, [id]);
    callback(null, { id, number: tableNumber });
  } catch (error) {
    callback(error);
  }
};

/* ================= MENU ================= */

exports.addMenuItem = (data, callback) => {
  const sql =
    "INSERT INTO menu_items (name, price, category, table_number, image_url, description, food_type, availability_status, tax, happy_hour_price, happy_hour_start, happy_hour_end) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";

  db.query(
    sql,
    [
      data.name,
      data.price,
      data.category,
      data.tableNumber,
      data.imageUrl || null,
      data.description || null,
      data.foodType || "Veg",
      data.status || "Available",
      Number(data.tax || 5),
      data.happyHourPrice != null && data.happyHourPrice !== "" ? Number(data.happyHourPrice) : null,
      data.happyHourStart || null,
      data.happyHourEnd || null,
    ],
    callback
  );
};

exports.updateMenuItem = (id, data, callback) => {
  const sql = `
    UPDATE menu_items
    SET name=?, price=?, category=?, table_number=?, image_url=?, description=?, food_type=?, availability_status=?, tax=?, happy_hour_price=?, happy_hour_start=?, happy_hour_end=?
    WHERE id=?
  `;

  db.query(
    sql,
    [
      data.name,
      data.price,
      data.category,
      data.tableNumber || null,
      data.imageUrl || null,
      data.description || null,
      data.foodType || "Veg",
      data.status || "Available",
      Number(data.tax || 5),
      data.happyHourPrice != null && data.happyHourPrice !== "" ? Number(data.happyHourPrice) : null,
      data.happyHourStart || null,
      data.happyHourEnd || null,
      id,
    ],
    callback,
  );
};

exports.deleteMenuItem = (id, callback) => {
  db.query("DELETE FROM menu_items WHERE id=?", [id], callback);
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
  createRestaurantBill(data)
    .then((result) => callback(null, result))
    .catch((error) => callback(error));
};

exports.getBills = (callback) => {
  db.query(
    `
      SELECT
        b.id,
        b.tableNumber,
        b.token_id AS tokenId,
        t.token_code AS tokenCode,
        b.entityType,
        b.waiter_name,
        b.customerName,
        b.phone,
        b.subtotal,
        b.gst,
        b.total,
        b.discountAmount,
        b.paymentMethod,
        b.invoiceStatus,
        b.split_no,
        b.split_count,
        b.paid_at,
        b.payment_id,
        b.account_transaction_id,
        b.created_at
      FROM bills b
      LEFT JOIN tokens t ON t.id = b.token_id
      ORDER BY b.id DESC
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

const buildResolvedWaiterName = (data) =>
  String(data.waiterName || "").trim() ||
  (String(data.entityType || "Table").toLowerCase() === "room" ? "Room Service" : "Waiter");

const findReusableOpenBill = async (conn, data) => {
  const normalizedStatus = String(data.invoiceStatus || "Saved").toLowerCase();
  const canReuseOpenBill = normalizedStatus !== "paid";
  if (!canReuseOpenBill) return null;

  if (data.tokenId) {
    const [rows] = await conn.query(
      `
        SELECT id
        FROM bills
        WHERE token_id=?
          AND entityType=?
          AND COALESCE(invoiceStatus, 'Saved') <> 'Paid'
          AND account_transaction_id IS NULL
        ORDER BY id DESC
        LIMIT 1
      `,
      [Number(data.tokenId), data.entityType || "Table"],
    );

    return rows[0] || null;
  }

  const [rows] = await conn.query(
    `
      SELECT id
      FROM bills
      WHERE tableNumber=?
        AND entityType=?
        AND COALESCE(invoiceStatus, 'Saved') <> 'Paid'
        AND account_transaction_id IS NULL
      ORDER BY id DESC
      LIMIT 1
    `,
    [data.table, data.entityType || "Table"],
  );

  return rows[0] || null;
};

const createBillRecord = async (conn, data, options = {}) => {
  const reusableBill = options.forceNew ? null : await findReusableOpenBill(conn, data);
  if (reusableBill?.id) {
    await conn.query(
      `
        UPDATE bills
        SET token_id=?,
            waiter_name=?,
            customerName=?,
            phone=?,
            subtotal=?,
            gst=?,
            total=?,
            discountAmount=?,
            paymentMethod=?,
            invoiceStatus=?,
            split_no=?,
            split_count=?
        WHERE id=?
      `,
      [
        data.tokenId ? Number(data.tokenId) : null,
        buildResolvedWaiterName(data),
        data.customerName || null,
        data.phone || null,
        Number(data.subtotal || 0),
        Number(data.gst || 0),
        Number(data.total || 0),
        Number(data.discountAmount || 0),
        data.paymentMethod || null,
        data.invoiceStatus || "Saved",
        data.splitNo || null,
        data.splitCount || null,
        reusableBill.id,
      ],
    );

    return reusableBill.id;
  }

  const sql = `
    INSERT INTO bills
    (tableNumber, token_id, entityType, waiter_name, customerName, phone, subtotal, gst, total, discountAmount, paymentMethod, invoiceStatus, split_no, split_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  const [result] = await conn.query(sql, [
    data.table,
    data.tokenId ? Number(data.tokenId) : null,
    data.entityType || "Table",
    buildResolvedWaiterName(data),
    data.customerName || null,
    data.phone || null,
    Number(data.subtotal || 0),
    Number(data.gst || 0),
    Number(data.total || 0),
    Number(data.discountAmount || 0),
    data.paymentMethod || null,
    data.invoiceStatus || "Saved",
    data.splitNo || null,
    data.splitCount || null,
  ]);

  return result.insertId;
};

const createRestaurantBill = async (data) => {
  const conn = await connection.getConnection();
  try {
    const billId = await createBillRecord(conn, data);
    const [rows] = await conn.query("SELECT * FROM bills WHERE id=? LIMIT 1", [billId]);
    return { insertId: billId, bill: rows?.[0] || null };
  } finally {
    conn.release();
  }
};

const processBillPayment = async (data) => {
  const conn = await connection.getConnection();
  const paymentsTableName = process.env.PAYMENTS_TABLE_NAME || "payments";

  try {
    await conn.beginTransaction();

    let billId = Number(data.billId || 0) || null;
    let billRow = null;

  if (billId) {
      const [existingBills] = await conn.query("SELECT * FROM bills WHERE id=? LIMIT 1 FOR UPDATE", [billId]);
      billRow = existingBills[0];

      if (!billRow) {
        const error = new Error("Bill not found");
        error.statusCode = 404;
        throw error;
      }

      if (String(billRow.invoiceStatus || "").toLowerCase() === "paid" || billRow.account_transaction_id) {
        const error = new Error("Bill already paid");
        error.statusCode = 409;
        throw error;
      }

      await conn.query(
        `
          UPDATE bills
          SET customerName=?,
              phone=?,
              subtotal=?,
              gst=?,
              total=?,
              discountAmount=?,
              paymentMethod=?
          WHERE id=?
        `,
        [
          data.customerName || billRow.customerName || null,
          data.phone || billRow.phone || null,
          Number(data.subtotal ?? billRow.subtotal ?? 0),
          Number(data.gst ?? billRow.gst ?? 0),
          Number(data.total ?? billRow.total ?? 0),
          Number(data.discountAmount ?? billRow.discountAmount ?? 0),
          data.paymentMethod || billRow.paymentMethod || null,
          billId,
        ],
      );

      const [updatedBills] = await conn.query("SELECT * FROM bills WHERE id=? LIMIT 1", [billId]);
      billRow = updatedBills[0];
    } else {
      billId = await createBillRecord(conn, {
        ...data,
        paymentMethod: data.paymentMethod,
        invoiceStatus: "Paid",
      }, { forceNew: true });

      const [createdBills] = await conn.query("SELECT * FROM bills WHERE id=? LIMIT 1", [billId]);
      billRow = createdBills[0];
    }

    const [paymentTables] = await conn.query("SHOW TABLES LIKE ?", [paymentsTableName]);
    if (!Array.isArray(paymentTables) || !paymentTables.length) {
      const error = new Error("Payments module is temporarily unavailable until the payments table is repaired.");
      error.statusCode = 503;
      throw error;
    }

    const [paymentResult] = await conn.query(
      `
        INSERT INTO ${paymentsTableName} (tableNumber, total, paymentMethod)
        VALUES (?, ?, ?)
      `,
      [
        billRow.tableNumber || data.table || null,
        Number(billRow.total || data.total || 0),
        data.paymentMethod || billRow.paymentMethod || null,
      ],
    );

    const transactionDate = new Date().toISOString().slice(0, 10);
    const entityLabel =
      String(billRow.entityType || data.entityType || "Table").toLowerCase() === "room" ? "Room" : "Table";
    const entityRef = billRow.tableNumber || data.table || "--";
    const description = `Restaurant bill payment - ${entityLabel} ${entityRef} - Bill #${billId}`;

    const [accountResult] = await conn.query(
      `
        INSERT INTO accounts_transactions (date, type, description, amount, payment_mode)
        VALUES (?, 'Income', ?, ?, ?)
      `,
      [transactionDate, description, Number(billRow.total || data.total || 0), data.paymentMethod || "Cash"],
    );

    await conn.query(
      `
        UPDATE bills
        SET invoiceStatus='Paid',
            paymentMethod=?,
            paid_at=NOW(),
            payment_id=?,
            account_transaction_id=?
        WHERE id=?
      `,
      [data.paymentMethod || billRow.paymentMethod || null, paymentResult.insertId, accountResult.insertId, billId],
    );

    await conn.commit();

    return {
      billId,
      paymentId: paymentResult.insertId,
      accountTransactionId: accountResult.insertId,
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

module.exports = {
  ensureSchema,
  addTable: exports.addTable,
  getTables: exports.getTables,
  updateTable: exports.updateTable,
  deleteTable: exports.deleteTable,
  addMenuItem: exports.addMenuItem,
  updateMenuItem: exports.updateMenuItem,
  deleteMenuItem: exports.deleteMenuItem,
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
  createRestaurantBill,
  processBillPayment,
};
