const db = require("../config/db");
// config/db.js already exports a mysql2 promise pool; db.promise() belongs to
// the callback API and throws TypeError here, aborting any process that requires
// this module.
const connection = db;
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
          table_number VARCHAR(50) NOT NULL,
          waiter_name VARCHAR(191) DEFAULT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await ensureColumn("orders", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER table_number");
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

      // bills is created snake_case to match the v4 live schema; CREATE only
      // fires on a brand-new database, the ensureColumn list below is a no-op
      // against any schema the migration has already shaped.
      await run(`
        CREATE TABLE IF NOT EXISTS bills (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_number VARCHAR(50) NOT NULL,
          entity_type VARCHAR(30) DEFAULT 'Table',
          customer_name VARCHAR(191) DEFAULT NULL,
          phone VARCHAR(30) DEFAULT NULL,
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
          tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          total DECIMAL(10,2) NOT NULL DEFAULT 0,
          payment_method VARCHAR(50) DEFAULT NULL,
          payment_status VARCHAR(50) DEFAULT 'unpaid',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await ensureColumn("bills", "customer_name", "VARCHAR(191) DEFAULT NULL AFTER table_number");
      await ensureColumn("bills", "token_id", "INT DEFAULT NULL AFTER table_number");
      await ensureColumn("bills", "entity_type", "VARCHAR(30) DEFAULT 'Table' AFTER table_number");
      await ensureColumn("bills", "phone", "VARCHAR(30) DEFAULT NULL AFTER customer_name");
      await ensureColumn("bills", "payment_status", "VARCHAR(50) DEFAULT 'unpaid' AFTER payment_method");
      await ensureColumn("bills", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER entity_type");
      await ensureColumn("bills", "split_no", "INT DEFAULT NULL AFTER payment_status");
      await ensureColumn("bills", "split_count", "INT DEFAULT NULL AFTER split_no");
      await ensureColumn("bills", "discount_amount", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total");
      await ensureColumn("bills", "paid_at", "DATETIME DEFAULT NULL AFTER split_count");
      await ensureColumn("bills", "service_charge", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER subtotal");

      // restaurant_bills is a minimal legacy shadow table on the live schema
      // (id, table_number, subtotal, tax_amount, total, status, created_at);
      // the v4 sync below only mirrors those columns.
      await run(`
        CREATE TABLE IF NOT EXISTS restaurant_bills (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_number VARCHAR(50) DEFAULT NULL,
          subtotal DECIMAL(10,2) DEFAULT 0,
          tax_amount DECIMAL(10,2) DEFAULT 0,
          total DECIMAL(10,2) DEFAULT 0,
          status VARCHAR(30) DEFAULT 'unpaid',
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

      // ── One-time waiter_name backfill ───────────────────────────────────
      await run(`
        UPDATE orders o
        LEFT JOIN tokens t
          ON t.table_number = o.table_number
         AND t.status = 'active'
        SET o.waiter_name = COALESCE(NULLIF(o.waiter_name, ''), t.waiter_name)
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

// One-time legacy bill sync. The v4 restaurant_bills table is a minimal
// shadow (id, table_number, subtotal, tax_amount, total, status, created_at)
// with no link back to bills, so there is no keyed sync to run.
const bootstrapLegacyBills = async () => {
  await ensureSchema();
  if (!schemaReady) return;
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
      "SELECT id FROM tokens WHERE table_number = ? AND status = 'active' LIMIT 1",
      [tableNumber],
    );
    if (activeTokens?.length) {
      const error = new Error("Tables with active tokens cannot be removed.");
      error.statusCode = 409;
      throw error;
    }

    const [pendingOrders] = await run(
      "SELECT id FROM orders WHERE table_number = ? AND status = 'pending' LIMIT 1",
      [tableNumber],
    );
    if (pendingOrders?.length) {
      const error = new Error("Tables with pending orders cannot be removed.");
      error.statusCode = 409;
      throw error;
    }

    const [pendingBills] = await run(
      "SELECT id FROM bills WHERE table_number = ? AND COALESCE(LOWER(payment_status), 'unpaid') <> 'paid' LIMIT 1",
      [tableNumber],
    );
    if (pendingBills?.length) {
      const error = new Error("Tables with pending bills cannot be removed.");
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
  db.query("INSERT INTO orders (table_number) VALUES (?)", [tableNumber], callback);
};

exports.getPendingOrder = (tableNumber, callback) => {
  const sql =
    "SELECT * FROM orders WHERE table_number=? AND status='pending'";

  db.query(sql, [tableNumber], (err, rows) => {
    callback(err, rows[0]);
  });
};

exports.addItemToOrder = (orderId, item, callback) => {
  const quantity = item.quantity ?? item.qty ?? 1;
  const price = Number(item.price || 0);
  const sql =
    "INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, total, notes) VALUES (?,?,?,?,?,?,?)";

  db.query(
    sql,
    [
      orderId,
      item.menuItemId ?? item.menuId ?? item.id ?? null,
      item.name,
      quantity,
      price,
      price * quantity,
      item.notes || null,
    ],
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
        b.table_number,
        b.token_id,
        t.token_code AS tokenCode,
        b.entity_type,
        b.waiter_name,
        b.customer_name,
        b.phone,
        b.subtotal,
        b.service_charge,
        b.tax_amount AS gst,
        b.total,
        b.discount_amount,
        b.payment_method,
        b.payment_status,
        b.split_no,
        b.split_count,
        b.paid_at,
        b.room_booking_id,
        b.room_booking_code,
        b.folio_entry_id,
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
  db.query("UPDATE orders SET status='completed' WHERE id=?", [orderId], callback);
};

exports.getBillById = (billId, callback) => {
  db.query(
    `
      SELECT
        b.id,
        b.table_number,
        b.token_id,
        t.token_code AS tokenCode,
        b.entity_type,
        b.waiter_name,
        b.customer_name,
        b.phone,
        b.subtotal,
        b.service_charge,
        b.tax_amount AS gst,
        b.total,
        b.discount_amount,
        b.payment_method,
        b.payment_status,
        b.split_no,
        b.split_count,
        b.paid_at,
        b.room_booking_id,
        b.room_booking_code,
        b.folio_entry_id,
        b.created_at
      FROM bills b
      LEFT JOIN tokens t ON t.id = b.token_id
      WHERE b.id = ?
      LIMIT 1
    `,
    [billId],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows?.[0] || null);
    },
  );
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

const isSettledPaymentStatus = (value) => {
  const normalized = normalizeInvoiceStatus(value);
  return normalized === "paid";
};

const normalizePaymentMethodForBills = (value) => {
  const allowed = new Set(["cash", "card", "upi", "wallet", "net_banking", "credit", "other"]);
  const s = String(value || "").toLowerCase().trim();
  if (!s) return null;
  return allowed.has(s) ? s : "other";
};

const normalizePaymentStatusForBills = (value) => {
  const s = String(value || "unpaid").toLowerCase().trim();
  const allowed = new Set(["unpaid", "partial", "paid", "refunded", "cancelled"]);
  return allowed.has(s) ? s : "unpaid";
};

const findReusableOpenBill = async (conn, data) => {
  if (normalizePaymentStatusForBills(data.invoiceStatus || data.paymentStatus) === "paid") return null;

  if (data.tokenId) {
    const [rows] = await conn.query(
      `
        SELECT id
        FROM bills
        WHERE token_id=?
          AND entity_type=?
          AND LOWER(COALESCE(payment_status, 'unpaid')) <> 'paid'
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
      WHERE table_number=?
        AND entity_type=?
        AND LOWER(COALESCE(payment_status, 'unpaid')) <> 'paid'
      ORDER BY id DESC
      LIMIT 1
    `,
    [data.table, data.entityType || "Table"],
  );

  return rows[0] || null;
};

// The v4 restaurant_bills table is a minimal shadow with no link back to
// bills, so there are no reusable legacy rows to match.
const findReusableLegacyBillRow = async () => null;

const syncLegacyRestaurantBill = async (conn, modernBillId) => {
  if (!modernBillId) return;

  const [billRows] = await conn.query(
    `
      SELECT
        table_number,
        subtotal,
        tax_amount,
        total,
        payment_status,
        created_at
      FROM bills
      WHERE id = ?
      LIMIT 1
    `,
    [modernBillId],
  );

  const billRow = billRows?.[0];
  if (!billRow) return;

  await conn.query(
    `
      INSERT INTO restaurant_bills (table_number, subtotal, tax_amount, total, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      billRow.table_number || null,
      Number(billRow.subtotal || 0),
      Number(billRow.tax_amount || 0),
      Number(billRow.total || 0),
      billRow.payment_status || "unpaid",
      billRow.created_at || null,
    ],
  );
};

const createBillRecord = async (conn, data, options = {}) => {
  const reusableBill = options.forceNew ? null : await findReusableOpenBill(conn, data);
  const paymentMethod = normalizePaymentMethodForBills(data.paymentMethod);
  const paymentStatus = normalizePaymentStatusForBills(data.invoiceStatus || data.paymentStatus);
  if (reusableBill?.id) {
    await conn.query(
      `
        UPDATE bills
        SET token_id=?,
            waiter_name=?,
            customer_name=?,
            phone=?,
            subtotal=?,
            tax_amount=?,
            total=?,
            discount_amount=?,
            payment_method=?,
            payment_status=?,
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
        paymentMethod,
        paymentStatus,
        data.splitNo || null,
        data.splitCount || null,
        reusableBill.id,
      ],
    );

    try {
      await syncLegacyRestaurantBill(conn, reusableBill.id);
    } catch (syncErr) {
      console.error("[RestaurantModel] Legacy bill sync failed (non-blocking):", syncErr.message);
    }

    return reusableBill.id;
  }

  // Release token_id from any settled bill that would block the INSERT
  if (data.tokenId) {
    await conn.query(
      `UPDATE bills SET token_id = NULL WHERE token_id = ? AND LOWER(COALESCE(payment_status, 'unpaid')) = 'paid'`,
      [Number(data.tokenId)],
    );
  }

  const sql = `
    INSERT INTO bills
    (table_number, token_id, entity_type, waiter_name, customer_name, phone, subtotal, service_charge, tax_amount, total, discount_amount, payment_method, payment_status, split_no, split_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  const [result] = await conn.query(sql, [
    data.table,
    data.tokenId ? Number(data.tokenId) : null,
    data.entityType || "Table",
    buildResolvedWaiterName(data),
    data.customerName || null,
    data.phone || null,
    Number(data.subtotal || 0),
    Number(data.serviceCharge || 0),
    Number(data.gst || 0),
    Number(data.total || 0),
    Number(data.discountAmount || 0),
    paymentMethod,
    paymentStatus,
    data.splitNo || null,
    data.splitCount || null,
  ]);

  try {
    await syncLegacyRestaurantBill(conn, result.insertId);
  } catch (syncErr) {
    console.error("[RestaurantModel] Legacy bill sync failed (non-blocking):", syncErr.message);
  }

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
            (? IS NOT NULL AND table_number = ? AND entity_type = ?)
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

      if (isSettledPaymentStatus(billRow.payment_status)) {
        const error = new Error("Bill already paid");
        error.statusCode = 409;
        throw error;
      }

      await conn.query(
        `
          UPDATE bills
          SET customer_name=?,
              phone=?,
              subtotal=?,
              service_charge=?,
              tax_amount=?,
              total=?,
              discount_amount=?,
              payment_method=?,
              paid_amount=COALESCE(paid_amount,0)+?
          WHERE id=?
        `,
        [
          data.customerName || billRow.customer_name || null,
          data.phone || billRow.phone || null,
          Number(data.subtotal ?? billRow.subtotal ?? 0),
          Number(data.serviceCharge ?? billRow.service_charge ?? 0),
          Number(data.gst ?? billRow.tax_amount ?? 0),
          Number(data.total ?? billRow.total ?? 0),
          Number(data.discountAmount ?? billRow.discount_amount ?? 0),
          normalizePaymentMethodForBills(data.paymentMethod || billRow.payment_method),
          Number(billRow.total ?? 0),
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
    }

    const [paymentTables] = await conn.query("SHOW TABLES LIKE ?", [paymentsTableName]);
    if (!Array.isArray(paymentTables) || !paymentTables.length) {
      const error = new Error("Payments module is temporarily unavailable until the payments table is repaired.");
      error.statusCode = 503;
      throw error;
    }

    const resolveMethodId = async (label) => {
      const value = normalizePaymentMethodForBills(label) || String(label || "").trim();
      if (!value) return null;
      try {
        const [rows] = await conn.query("SELECT id FROM payment_methods WHERE LOWER(name) = LOWER(?) LIMIT 1", [value]);
        if (rows && rows[0]) return rows[0].id;
        const code = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "other";
        const [result] = await conn.query(
          "INSERT INTO payment_methods (name, code, is_active) VALUES (?, ?, 1)",
          [value, code],
        );
        if (result?.insertId) return result.insertId;
      } catch {
        /* unique-name race: fall through */
      }
      const [retry] = await conn.query("SELECT id FROM payment_methods ORDER BY id ASC LIMIT 1");
      return retry?.[0]?.id || null;
    };

    const paymentMethodLabel = normalizePaymentMethodForBills(data.paymentMethod || billRow.payment_method);
    const [paymentResult] = await conn.query(
      `
        INSERT INTO ${paymentsTableName} (bill_id, amount, payment_method_id, payment_type, status, created_at)
        VALUES (?, ?, ?, 'payment', 'completed', NOW())
      `,
      [
        Number(billId),
        Number(billRow.total || data.total || 0),
        await resolveMethodId(paymentMethodLabel || "cash"),
      ],
    );

    const transactionDate = new Date().toISOString().slice(0, 10);
    const entityLabel =
      String(billRow.entity_type || data.entityType || "Table").toLowerCase() === "room" ? "Room" : "Table";
    const entityRef = billRow.table_number || data.table || "--";
    const description = `Restaurant bill payment - ${entityLabel} ${entityRef} - Bill #${billId}`;

    const [accountResult] = await conn.query(
      `
        INSERT INTO accounts_transactions (date, type, description, amount, payment_mode)
        VALUES (?, 'Income', ?, ?, ?)
      `,
      [transactionDate, description, Number(billRow.total || data.total || 0), paymentMethodLabel || "cash"],
    );

    await conn.query(
      `
        UPDATE bills
        SET payment_status='paid',
            payment_method=?,
            paid_amount=COALESCE(paid_amount,0)+?,
            paid_at=NOW()
        WHERE id=?
      `,
      [paymentMethodLabel, Number(billRow.total || data.total || 0), billId],
    );

    if (billRow.table_number) {
      await conn.query(
        "UPDATE tokens SET status='completed' WHERE table_number=? AND status='active'",
        [billRow.table_number],
      );

      await conn.query(
        "UPDATE orders SET status='completed' WHERE table_number=? AND status='pending'",
        [billRow.table_number],
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
      log("existing bill lookup done", { found: !!billRow, payment_status: billRow?.payment_status });
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
        invoiceStatus: "unpaid",
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

    if (isSettledPaymentStatus(billRow.payment_status) || billRow.folio_entry_id) {
      const error = new Error("This bill is already settled and cannot be posted to room.");
      error.statusCode = 409;
      throw error;
    }

    const sourceTableNumber = String(data.sourceTableNumber || billRow.table_number || "").trim();
    const targetRoomNumber = String(data.roomNumber || "").trim();
    log("looking up booking", { targetRoomNumber, bookingId: data?.bookingId });
    const booking = await getRoomChargeableBooking(conn, targetRoomNumber, data.bookingId || null);
    log("booking lookup done", { found: !!booking });

    if (!booking) {
      const error = new Error(`Active in-house booking not found for room "${targetRoomNumber}". Please verify the room is checked in.`);
      error.statusCode = 404;
      throw error;
    }

    const customerName = String(data.customerName || booking.guestName || billRow.customer_name || "").trim();
    const phone = String(data.phone || booking.mobile || billRow.phone || "").trim();
    const description = `Restaurant charge from Table ${sourceTableNumber || "--"} | Bill #${billId}`;
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
          customer_name = ?,
          phone = ?,
          total = ?,
          discount_amount = ?,
          payment_method = 'credit',
          payment_status = 'paid',
          room_booking_id = ?,
          room_booking_code = ?,
          folio_entry_id = ?,
          paid_at = NOW()
        WHERE id = ?
      `,
      [
        customerName || null,
        phone || null,
        Number(data.total ?? billRow.total ?? 0),
        Number(data.discountAmount ?? billRow.discount_amount ?? 0),
        Number(booking.bookingId),
        booking.bookingCode || null,
        folioResult.insertId,
        billId,
      ],
    );
    log("bill updated to posted-to-room");

    if (billRow.table_number) {
      await conn.query(
        "UPDATE tokens SET status='completed' WHERE table_number=? AND status='active'",
        [billRow.table_number],
      );
      await conn.query(
        "UPDATE orders SET status='completed' WHERE table_number=? AND status='pending'",
        [billRow.table_number],
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
  getBillById: exports.getBillById,
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
