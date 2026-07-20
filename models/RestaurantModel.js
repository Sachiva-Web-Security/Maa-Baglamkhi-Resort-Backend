const db = require("../config/db");
const connection = db.promise();
const TABLES_TABLE = "restaurant_tables";
const folioModel = require("./folioModel");

const run = (sql, params = []) => connection.query(sql, params);
const normalizeMatchValue = (value) => String(value || "").trim().toLowerCase();
const normalizeEntityType = (value) => normalizeMatchValue(value || "Table");
const normalizeInvoiceStatus = (value) => normalizeMatchValue(value);
const toComparableTime = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

// Schema bootstrap runs ONCE per process. ensureSchema() is now a cheap no-op
// after the first call, so per-request endpoints (like chargeBillToRoom) no
// longer pay the cost of a full DDL + legacy-sync pass on every call.
let schemaReady = false;
let bootstrapInFlight = null;

const scoreLegacyBillCandidate = (billRow, legacyRow) => {
  const billTokenId = Number(billRow?.tokenId || 0);
  const legacyTokenId = Number(legacyRow?.tokenId || 0);
  const sameEntityType = normalizeEntityType(legacyRow?.entityType) === normalizeEntityType(billRow?.entityType);
  const sameTable = normalizeMatchValue(legacyRow?.tableNumber) === normalizeMatchValue(billRow?.tableNumber);
  let score = 0;

  if (billTokenId && legacyTokenId === billTokenId && sameEntityType) score += 100;
  if (sameTable && sameEntityType) score += 40;
  if (Number(legacyRow?.total || 0) === Number(billRow?.total || 0)) score += 10;
  if (Number(legacyRow?.subtotal || 0) === Number(billRow?.subtotal || 0)) score += 6;
  if (normalizeMatchValue(legacyRow?.customerName) && normalizeMatchValue(legacyRow?.customerName) === normalizeMatchValue(billRow?.customerName)) score += 4;
  if (normalizeMatchValue(legacyRow?.phone) && normalizeMatchValue(legacyRow?.phone) === normalizeMatchValue(billRow?.phone)) score += 4;
  if (normalizeMatchValue(legacyRow?.paymentMethod) && normalizeMatchValue(legacyRow?.paymentMethod) === normalizeMatchValue(billRow?.paymentMethod)) score += 2;
  if (normalizeMatchValue(legacyRow?.invoiceStatus) && normalizeMatchValue(legacyRow?.invoiceStatus) === normalizeMatchValue(billRow?.invoiceStatus)) score += 2;

  return score;
};

const pickBestLegacyBillCandidate = (billRow, legacyRows) =>
  [...legacyRows].sort((leftRow, rightRow) => {
    const scoreDiff = scoreLegacyBillCandidate(billRow, rightRow) - scoreLegacyBillCandidate(billRow, leftRow);
    if (scoreDiff !== 0) return scoreDiff;

    const billTime = toComparableTime(billRow?.created_at);
    const leftDiff = Math.abs(toComparableTime(leftRow?.created_at) - billTime);
    const rightDiff = Math.abs(toComparableTime(rightRow?.created_at) - billTime);
    if (leftDiff !== rightDiff) return leftDiff - rightDiff;

    return Number(rightRow?.id || 0) - Number(leftRow?.id || 0);
  })[0] || null;

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
  if (schemaReady) return;
  if (bootstrapInFlight) {
    console.log("[RestaurantModel] Waiting for in-flight schema bootstrap...");
    await bootstrapInFlight;
    return;
  }

  console.log("[RestaurantModel] Running one-time schema bootstrap...");
  bootstrapInFlight = (async () => {
    try {
      // ── DDL ONLY — fast, idempotent ─────────────────────────────────────
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
          waiter_name VARCHAR(191) DEFAULT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await ensureColumn("orders", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER tableNumber");
      await ensureIndex("orders", "idx_orders_waiter_name", "INDEX idx_orders_waiter_name (waiter_name)");

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
      await ensureColumn("bills", "posted_to_room", "TINYINT(1) NOT NULL DEFAULT 0 AFTER account_transaction_id");
      await ensureColumn("bills", "posted_room_number", "VARCHAR(50) DEFAULT NULL AFTER posted_to_room");
      await ensureColumn("bills", "room_booking_id", "INT DEFAULT NULL AFTER posted_room_number");
      await ensureColumn("bills", "room_booking_code", "VARCHAR(80) DEFAULT NULL AFTER room_booking_id");
      await ensureColumn("bills", "folio_entry_id", "INT DEFAULT NULL AFTER room_booking_code");
      await ensureColumn("bills", "source_table_number", "VARCHAR(50) DEFAULT NULL AFTER folio_entry_id");
      await ensureColumn("bills", "posted_at", "DATETIME DEFAULT NULL AFTER source_table_number");
      await ensureIndex("bills", "uniq_bills_token_id", "UNIQUE KEY uniq_bills_token_id (token_id)");

      await run(`
        CREATE TABLE IF NOT EXISTS restaurant_bills (
          id INT AUTO_INCREMENT PRIMARY KEY,
          modern_bill_id INT DEFAULT NULL,
          tableNumber VARCHAR(50) DEFAULT NULL,
          tokenId INT DEFAULT NULL,
          entityType VARCHAR(30) DEFAULT 'Table',
          waiter_name VARCHAR(191) DEFAULT NULL,
          customerName VARCHAR(191) DEFAULT NULL,
          phone VARCHAR(30) DEFAULT NULL,
          subtotal DECIMAL(10,2) DEFAULT 0,
          gst DECIMAL(10,2) DEFAULT 0,
          discount DECIMAL(10,2) DEFAULT 0,
          total DECIMAL(10,2) DEFAULT 0,
          paymentMethod VARCHAR(50) DEFAULT NULL,
          invoiceStatus VARCHAR(30) DEFAULT 'unpaid',
          paid_at DATETIME DEFAULT NULL,
          payment_id INT DEFAULT NULL,
          account_transaction_id INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await ensureColumn("restaurant_bills", "modern_bill_id", "INT DEFAULT NULL AFTER id");
      await ensureColumn("restaurant_bills", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER entityType");
      await ensureColumn("restaurant_bills", "customerName", "VARCHAR(191) DEFAULT NULL AFTER waiter_name");
      await ensureColumn("restaurant_bills", "phone", "VARCHAR(30) DEFAULT NULL AFTER customerName");
      await ensureColumn("restaurant_bills", "paid_at", "DATETIME DEFAULT NULL AFTER invoiceStatus");
      await ensureColumn("restaurant_bills", "payment_id", "INT DEFAULT NULL AFTER paid_at");
      await ensureColumn("restaurant_bills", "account_transaction_id", "INT DEFAULT NULL AFTER payment_id");
      await ensureColumn("restaurant_bills", "posted_to_room", "TINYINT(1) NOT NULL DEFAULT 0 AFTER account_transaction_id");
      await ensureColumn("restaurant_bills", "posted_room_number", "VARCHAR(50) DEFAULT NULL AFTER posted_to_room");
      await ensureColumn("restaurant_bills", "room_booking_id", "INT DEFAULT NULL AFTER posted_room_number");
      await ensureColumn("restaurant_bills", "room_booking_code", "VARCHAR(80) DEFAULT NULL AFTER room_booking_id");
      await ensureColumn("restaurant_bills", "folio_entry_id", "INT DEFAULT NULL AFTER room_booking_code");
      await ensureColumn("restaurant_bills", "source_table_number", "VARCHAR(50) DEFAULT NULL AFTER folio_entry_id");
      await ensureColumn("restaurant_bills", "posted_at", "DATETIME DEFAULT NULL AFTER source_table_number");
      await ensureIndex("restaurant_bills", "uniq_restaurant_bills_modern_bill_id", "UNIQUE KEY uniq_restaurant_bills_modern_bill_id (modern_bill_id)");

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

      // ── One-time waiter_name backfill ───────────────────────────────────
      await run(`
        UPDATE orders o
        LEFT JOIN tokens t
          ON t.tableNumber = o.tableNumber
         AND t.status = 'active'
        SET o.waiter_name = COALESCE(NULLIF(o.waiter_name, ''), t.waiter)
        WHERE o.waiter_name IS NULL OR o.waiter_name = ''
      `);

      schemaReady = true;
      console.log("[RestaurantModel] Schema bootstrap complete.");
    } finally {
      bootstrapInFlight = null;
    }
  })();

  await bootstrapInFlight;
};

// One-time migration: sync legacy restaurant_bills rows from bills.
// Safe to call independently — does NOT re-run if already synced.
const bootstrapLegacyBills = async () => {
  await ensureSchema();
  if (!schemaReady) return;

  console.log("[RestaurantModel] Running legacy bill sync...");
  try {
    await run(`
      UPDATE restaurant_bills rb
      INNER JOIN bills b ON b.id = rb.modern_bill_id
      SET
        rb.tableNumber = b.tableNumber,
        rb.tokenId = b.token_id,
        rb.entityType = b.entityType,
        rb.waiter_name = b.waiter_name,
        rb.customerName = b.customerName,
        rb.phone = b.phone,
        rb.subtotal = b.subtotal,
        rb.gst = b.gst,
        rb.discount = COALESCE(b.discountAmount, 0),
        rb.total = b.total,
        rb.paymentMethod = b.paymentMethod,
        rb.invoiceStatus = b.invoiceStatus,
        rb.paid_at = b.paid_at,
        rb.payment_id = b.payment_id,
        rb.account_transaction_id = b.account_transaction_id,
        rb.posted_to_room = COALESCE(b.posted_to_room, 0),
        rb.posted_room_number = b.posted_room_number,
        rb.room_booking_id = b.room_booking_id,
        rb.room_booking_code = b.room_booking_code,
        rb.folio_entry_id = b.folio_entry_id,
        rb.source_table_number = b.source_table_number,
        rb.posted_at = b.posted_at
    `);

    const [unlinkedBills] = await run(`
      SELECT b.id
      FROM bills b
      LEFT JOIN restaurant_bills rb ON rb.modern_bill_id = b.id
      WHERE rb.id IS NULL
      ORDER BY b.created_at ASC, b.id ASC
    `);

    for (const billRow of unlinkedBills) {
      await syncLegacyRestaurantBill(connection, billRow.id);
    }

    await run(`
      UPDATE restaurant_bills rb
      LEFT JOIN bills bt ON bt.token_id = rb.tokenId
      LEFT JOIN bills bb ON bb.tableNumber = rb.tableNumber AND bb.entityType = rb.entityType
      SET
        rb.tableNumber = COALESCE(rb.tableNumber, bt.tableNumber, bb.tableNumber),
        rb.waiter_name = COALESCE(rb.waiter_name, bt.waiter_name, bb.waiter_name),
        rb.customerName = COALESCE(rb.customerName, bt.customerName, bb.customerName),
        rb.phone = COALESCE(rb.phone, bt.phone, bb.phone),
        rb.paymentMethod = COALESCE(rb.paymentMethod, bt.paymentMethod, bb.paymentMethod),
        rb.invoiceStatus = COALESCE(NULLIF(rb.invoiceStatus, 'unpaid'), bt.invoiceStatus, bb.invoiceStatus, rb.invoiceStatus),
        rb.paid_at = COALESCE(rb.paid_at, bt.paid_at, bb.paid_at),
        rb.payment_id = COALESCE(rb.payment_id, bt.payment_id, bb.payment_id),
        rb.account_transaction_id = COALESCE(rb.account_transaction_id, bt.account_transaction_id, bb.account_transaction_id),
        rb.posted_to_room = COALESCE(rb.posted_to_room, bt.posted_to_room, bb.posted_to_room, rb.posted_to_room),
        rb.posted_room_number = COALESCE(rb.posted_room_number, bt.posted_room_number, bb.posted_room_number),
        rb.room_booking_id = COALESCE(rb.room_booking_id, bt.room_booking_id, bb.room_booking_id),
        rb.room_booking_code = COALESCE(rb.room_booking_code, bt.room_booking_code, bb.room_booking_code),
        rb.folio_entry_id = COALESCE(rb.folio_entry_id, bt.folio_entry_id, bb.folio_entry_id),
        rb.source_table_number = COALESCE(rb.source_table_number, bt.source_table_number, bb.source_table_number),
        rb.posted_at = COALESCE(rb.posted_at, bt.posted_at, bb.posted_at),
        rb.subtotal = CASE
          WHEN COALESCE(rb.subtotal, 0) = 0 THEN COALESCE(bt.subtotal, bb.subtotal, rb.subtotal)
          ELSE rb.subtotal
        END,
        rb.gst = CASE
          WHEN COALESCE(rb.gst, 0) = 0 THEN COALESCE(bt.gst, bb.gst, rb.gst)
          ELSE rb.gst
        END,
        rb.discount = CASE
          WHEN COALESCE(rb.discount, 0) = 0 THEN COALESCE(bt.discountAmount, bb.discountAmount, rb.discount)
          ELSE rb.discount
        END,
        rb.total = CASE
          WHEN COALESCE(rb.total, 0) = 0 THEN COALESCE(bt.total, bb.total, rb.total)
          ELSE rb.total
        END
      WHERE rb.modern_bill_id IS NULL
    `);

    console.log("[RestaurantModel] Legacy bill sync complete.");
  } catch (err) {
    console.error("[RestaurantModel] Legacy bill sync failed:", err.message);
  }
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
        b.posted_to_room AS postedToRoom,
        b.posted_room_number AS postedRoomNumber,
        b.room_booking_id AS roomBookingId,
        b.room_booking_code AS roomBookingCode,
        b.folio_entry_id AS folioEntryId,
        b.source_table_number AS sourceTableNumber,
        b.posted_at AS postedAt,
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

const isSettledInvoiceStatus = (value) => {
  const normalized = normalizeInvoiceStatus(value);
  return normalized === "paid" || normalized === "posted to room";
};

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
          AND COALESCE(invoiceStatus, 'Saved') NOT IN ('Paid', 'Posted To Room')
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
        AND COALESCE(invoiceStatus, 'Saved') NOT IN ('Paid', 'Posted To Room')
        AND account_transaction_id IS NULL
      ORDER BY id DESC
      LIMIT 1
    `,
    [data.table, data.entityType || "Table"],
  );

  return rows[0] || null;
};

const findReusableLegacyBillRow = async (conn, billRow) => {
  const tokenId = Number(billRow?.tokenId || 0) || null;
  const entityType = billRow?.entityType || "Table";
  const tableNumber = billRow?.tableNumber || null;

  const [legacyRows] = await conn.query(
    `
      SELECT
        id,
        tableNumber,
        tokenId,
        entityType,
        waiter_name,
        customerName,
        phone,
        subtotal,
        gst,
        discount,
        total,
        paymentMethod,
        invoiceStatus,
        paid_at,
        payment_id,
        account_transaction_id,
        created_at
      FROM restaurant_bills
      WHERE modern_bill_id IS NULL
        AND (
          (? IS NOT NULL AND tokenId = ? AND COALESCE(entityType, 'Table') = ?)
          OR
          (? IS NOT NULL AND tableNumber = ? AND COALESCE(entityType, 'Table') = ?)
        )
      ORDER BY created_at DESC, id DESC
    `,
    [tokenId, tokenId, entityType, tableNumber, tableNumber, entityType],
  );

  const candidates = Array.isArray(legacyRows)
    ? legacyRows.filter((row) => scoreLegacyBillCandidate(billRow, row) > 0)
    : [];

  return pickBestLegacyBillCandidate(billRow, candidates);
};

const syncLegacyRestaurantBill = async (conn, modernBillId) => {
  if (!modernBillId) return;

  const [billRows] = await conn.query(
    `
      SELECT
        id,
        tableNumber,
        token_id AS tokenId,
        entityType,
        waiter_name,
        customerName,
        phone,
        subtotal,
        gst,
        discountAmount,
        total,
        paymentMethod,
        invoiceStatus,
        paid_at,
        payment_id,
        account_transaction_id,
        posted_to_room AS postedToRoom,
        posted_room_number AS postedRoomNumber,
        room_booking_id AS roomBookingId,
        room_booking_code AS roomBookingCode,
        folio_entry_id AS folioEntryId,
        source_table_number AS sourceTableNumber,
        posted_at AS postedAt,
        created_at
      FROM bills
      WHERE id = ?
      LIMIT 1
    `,
    [modernBillId],
  );

  const billRow = billRows?.[0];
  if (!billRow) return;

  const payload = [
    billRow.tableNumber || null,
    billRow.tokenId ? Number(billRow.tokenId) : null,
    billRow.entityType || "Table",
    billRow.waiter_name || null,
    billRow.customerName || null,
    billRow.phone || null,
    Number(billRow.subtotal || 0),
    Number(billRow.gst || 0),
    Number(billRow.discountAmount || 0),
    Number(billRow.total || 0),
    billRow.paymentMethod || null,
    billRow.invoiceStatus || "Saved",
    billRow.paid_at || null,
    billRow.payment_id || null,
    billRow.account_transaction_id || null,
    Number(billRow.postedToRoom || 0),
    billRow.postedRoomNumber || null,
    billRow.roomBookingId || null,
    billRow.roomBookingCode || null,
    billRow.folioEntryId || null,
    billRow.sourceTableNumber || null,
    billRow.postedAt || null,
    billRow.created_at || null,
    Number(modernBillId),
  ];

  const [legacyRows] = await conn.query("SELECT id FROM restaurant_bills WHERE modern_bill_id = ? LIMIT 1", [modernBillId]);

  if (legacyRows?.[0]?.id) {
    await conn.query(
      `
        UPDATE restaurant_bills
        SET
          tableNumber = ?,
          tokenId = ?,
          entityType = ?,
          waiter_name = ?,
          customerName = ?,
          phone = ?,
          subtotal = ?,
          gst = ?,
          discount = ?,
          total = ?,
          paymentMethod = ?,
          invoiceStatus = ?,
          paid_at = ?,
          payment_id = ?,
          account_transaction_id = ?,
          posted_to_room = ?,
          posted_room_number = ?,
          room_booking_id = ?,
          room_booking_code = ?,
          folio_entry_id = ?,
          source_table_number = ?,
          posted_at = ?,
          created_at = ?
        WHERE modern_bill_id = ?
      `,
      payload,
    );
    return;
  }

  const reusableLegacyRow = await findReusableLegacyBillRow(conn, billRow);
  if (reusableLegacyRow?.id) {
    await conn.query(
      `
        UPDATE restaurant_bills
        SET
          modern_bill_id = ?,
          tableNumber = ?,
          tokenId = ?,
          entityType = ?,
          waiter_name = ?,
          customerName = ?,
          phone = ?,
          subtotal = ?,
          gst = ?,
          discount = ?,
          total = ?,
          paymentMethod = ?,
          invoiceStatus = ?,
          paid_at = ?,
          payment_id = ?,
          account_transaction_id = ?,
          posted_to_room = ?,
          posted_room_number = ?,
          room_booking_id = ?,
          room_booking_code = ?,
          folio_entry_id = ?,
          source_table_number = ?,
          posted_at = ?,
          created_at = ?
        WHERE id = ?
          AND modern_bill_id IS NULL
      `,
      [Number(modernBillId), ...payload.slice(0, -1), reusableLegacyRow.id],
    );
    return;
  }

  await conn.query(
    `
      INSERT INTO restaurant_bills (
        tableNumber,
        tokenId,
        entityType,
        waiter_name,
        customerName,
        phone,
        subtotal,
        gst,
        discount,
        total,
        paymentMethod,
        invoiceStatus,
        paid_at,
        payment_id,
        account_transaction_id,
        posted_to_room,
        posted_room_number,
        room_booking_id,
        room_booking_code,
        folio_entry_id,
        source_table_number,
        posted_at,
        created_at,
        modern_bill_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
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

    await syncLegacyRestaurantBill(conn, reusableBill.id);

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

  await syncLegacyRestaurantBill(conn, result.insertId);

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

    if (!billId) {
      const lookupTokenId = Number(data.tokenId || 0) || null;
      const lookupEntityType = data.entityType || "Table";
      const lookupTable = data.table || null;
      const [matchedBills] = await conn.query(
        `
          SELECT *
          FROM bills
          WHERE (
            (? IS NOT NULL AND token_id = ?)
            OR
            (? IS NOT NULL AND tableNumber = ? AND entityType = ?)
          )
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [lookupTokenId, lookupTokenId, lookupTable, lookupTable, lookupEntityType],
      );

      if (matchedBills?.[0]?.id) {
        billId = Number(matchedBills[0].id);
      }
    }

    if (billId) {
      const [existingBills] = await conn.query("SELECT * FROM bills WHERE id=? LIMIT 1 FOR UPDATE", [billId]);
      billRow = existingBills[0];

      if (!billRow) {
        const error = new Error("Bill not found");
        error.statusCode = 404;
        throw error;
      }

      if (isSettledInvoiceStatus(billRow.invoiceStatus) || billRow.account_transaction_id) {
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

      await syncLegacyRestaurantBill(conn, billId);

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

    if (billRow.tableNumber) {
      await conn.query(
        "UPDATE tokens SET status='closed' WHERE tableNumber=? AND status='active'",
        [billRow.tableNumber],
      );

      await conn.query(
        "UPDATE orders SET status='paid' WHERE tableNumber=? AND status='pending'",
        [billRow.tableNumber],
      );
    }

    await syncLegacyRestaurantBill(conn, billId);

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

const getRoomChargeableBooking = async (conn, roomNumber, bookingId = null) => {
  const trimmedRoomNumber = String(roomNumber || "").trim();
  if (!trimmedRoomNumber) return null;

  const params = [trimmedRoomNumber];
  let sql = `
    SELECT
      g.id AS bookingId,
      g.booking_code AS bookingCode,
      g.guest_name AS guestName,
      g.mobile,
      g.booking_status AS bookingStatus,
      CAST(rt.room_number AS CHAR) AS roomNumber
    FROM guests g
    INNER JOIN room_tariff rt ON rt.booking_id = g.id
    WHERE CAST(rt.room_number AS CHAR) = CAST(? AS CHAR)
      AND LOWER(COALESCE(g.booking_status, 'confirmed')) NOT IN ('checked out', 'cancelled')
  `;

  if (bookingId) {
    sql += " AND g.id = ?";
    params.push(Number(bookingId));
  }

  sql += `
    ORDER BY
      CASE
        WHEN LOWER(COALESCE(g.booking_status, '')) LIKE '%checked in%' THEN 0
        WHEN LOWER(COALESCE(g.booking_status, '')) LIKE '%occupied%' THEN 1
        WHEN LOWER(COALESCE(g.booking_status, '')) LIKE '%in house%' THEN 2
        ELSE 3
      END,
      g.id DESC
    LIMIT 1
  `;

  const [rows] = await conn.query(sql, params);
  const booking = rows?.[0] || null;
  if (!booking) return null;

  const normalizedStatus = normalizeMatchValue(booking.bookingStatus);
  const isActiveStay =
    normalizedStatus.includes("checked in") ||
    normalizedStatus.includes("occupied") ||
    normalizedStatus.includes("in house");

  return isActiveStay ? booking : null;
};

const chargeBillToRoom = async (data) => {
  const traceId = `cbr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const log = (msg, extra) =>
    console.log(`[chargeBillToRoom ${traceId}] ${msg}`, extra !== undefined ? JSON.stringify(extra) : "");

  log("START", {
    billId: data?.billId,
    roomNumber: data?.roomNumber,
    bookingId: data?.bookingId,
    total: data?.total,
    splitCount: data?.splitCount,
    splitsLen: Array.isArray(data?.splits) ? data.splits.length : 0,
    table: data?.table,
    tableNumber: data?.tableNumber,
  });

  // Fast-path: schema is now memoized after first call.
  await ensureSchema();
  await folioModel.ensureSchema();
  log("schema ready");

  const conn = await connection.getConnection();
  log("connection acquired");

  try {
    await conn.beginTransaction();
    log("transaction started");

    let billId = Number(data.billId || 0) || null;
    let billRow = null;

    if (billId) {
      log("looking up existing bill", { billId });
      const [existingBills] = await conn.query("SELECT * FROM bills WHERE id = ? LIMIT 1 FOR UPDATE", [billId]);
      billRow = existingBills?.[0] || null;
      log("existing bill lookup done", { found: !!billRow, invoiceStatus: billRow?.invoiceStatus });
    }

    if (!billRow) {
      log("creating new bill record");
      billId = await createBillRecord(conn, {
        table: data.table || data.tableNumber,
        tokenId: data.tokenId || null,
        entityType: data.entityType || "Table",
        waiterName: data.waiterName || null,
        customerName: data.customerName || "",
        phone: data.phone || "",
        subtotal: Number(data.subtotal || 0),
        gst: Number(data.gst || 0),
        total: Number(data.total || 0),
        discountAmount: Number(data.discountAmount || 0),
        paymentMethod: null,
        invoiceStatus: "Generated",
        splitCount: data.splitCount || null,
      });

      const [createdBills] = await conn.query("SELECT * FROM bills WHERE id = ? LIMIT 1 FOR UPDATE", [billId]);
      billRow = createdBills?.[0] || null;
      log("bill created", { billId });
    }

    if (!billRow) {
      const error = new Error("Bill not found");
      error.statusCode = 404;
      throw error;
    }

    if (isSettledInvoiceStatus(billRow.invoiceStatus) || billRow.account_transaction_id) {
      const error = new Error("This bill is already settled and cannot be posted to room.");
      error.statusCode = 409;
      throw error;
    }

    if (Number(billRow.posted_to_room || 0) || billRow.folio_entry_id) {
      const error = new Error("This bill has already been posted to a room folio.");
      error.statusCode = 409;
      throw error;
    }

    const sourceTableNumber = String(data.sourceTableNumber || billRow.source_table_number || billRow.tableNumber || "").trim();
    const targetRoomNumber = String(data.roomNumber || "").trim();
    log("looking up booking", { targetRoomNumber, bookingId: data?.bookingId });
    const booking = await getRoomChargeableBooking(conn, targetRoomNumber, data.bookingId || null);
    log("booking lookup done", { found: !!booking });

    if (!booking) {
      const error = new Error(`Active in-house booking not found for room "${targetRoomNumber}". Please verify the room is checked in.`);
      error.statusCode = 404;
      throw error;
    }

    const customerName = String(data.customerName || booking.guestName || billRow.customerName || "").trim();
    const phone = String(data.phone || booking.mobile || billRow.phone || "").trim();
    const description = `Restaurant charge from Table ${sourceTableNumber || billRow.tableNumber || "--"} | Bill #${billId}`;
    const entryDate = new Date().toISOString().slice(0, 10);

    log("inserting folio entry", { bookingId: booking.bookingId, amount: Number(data.total ?? billRow.total ?? 0) });
    const [folioResult] = await conn.query(
      `
        INSERT INTO hotel_folio_entries
          (booking_id, entry_date, entry_type, category, description, amount, created_by)
        VALUES (?, ?, 'Extra Charge', 'Restaurant', ?, ?, ?)
      `,
      [
        Number(booking.bookingId),
        entryDate,
        description,
        Number(data.total ?? billRow.total ?? 0),
        data.createdBy || "Restaurant POS",
      ],
    );
    log("folio entry inserted", { folioEntryId: folioResult.insertId });

    await conn.query(
      `
        UPDATE bills
        SET
          customerName = ?,
          phone = ?,
          total = ?,
          discountAmount = ?,
          paymentMethod = ?,
          invoiceStatus = 'Posted To Room',
          posted_to_room = 1,
          posted_room_number = ?,
          room_booking_id = ?,
          room_booking_code = ?,
          folio_entry_id = ?,
          source_table_number = ?,
          posted_at = NOW()
        WHERE id = ?
      `,
      [
        customerName || null,
        phone || null,
        Number(data.total ?? billRow.total ?? 0),
        Number(data.discountAmount ?? billRow.discountAmount ?? 0),
        "Charge To Room",
        booking.roomNumber,
        Number(booking.bookingId),
        booking.bookingCode || null,
        folioResult.insertId,
        sourceTableNumber || null,
        billId,
      ],
    );
    log("bill updated to Posted To Room");

    if (billRow.tableNumber) {
      await conn.query(
        "UPDATE tokens SET status='closed' WHERE tableNumber=? AND status='active'",
        [billRow.tableNumber],
      );
      await conn.query(
        "UPDATE orders SET status='paid' WHERE tableNumber=? AND status='pending'",
        [billRow.tableNumber],
      );
    }

    await syncLegacyRestaurantBill(conn, billId);
    log("legacy bill sync done");

    await conn.commit();
    log("transaction committed");

    const [updatedBills] = await conn.query("SELECT * FROM bills WHERE id = ? LIMIT 1", [billId]);

    log("END SUCCESS", { billId, folioEntryId: folioResult.insertId });

    return {
      billId,
      folioEntryId: folioResult.insertId,
      bookingId: Number(booking.bookingId),
      bookingCode: booking.bookingCode || null,
      roomNumber: booking.roomNumber,
      bill: updatedBills?.[0] || null,
    };
  } catch (error) {
    log("ERROR caught", { message: error?.message, statusCode: error?.statusCode });
    try {
      await conn.rollback();
      log("transaction rolled back");
    } catch (rollbackErr) {
      log("rollback failed", { message: rollbackErr?.message });
    }
    throw error;
  } finally {
    try {
      conn.release();
    } catch (releaseErr) {
      log("connection release failed", { message: releaseErr?.message });
    }
  }
};

module.exports = {
  ensureSchema,
  bootstrapLegacyBills,
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
  chargeBillToRoom,
};
