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
        CREATE TABLE IF NOT EXISTS menu_categories (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          description TEXT DEFAULT NULL,
          sort_order INT DEFAULT 0,
          is_active TINYINT(1) DEFAULT 1
        )
      `);
      await run(`
        INSERT IGNORE INTO menu_categories (id, name, sort_order) VALUES
          (1, 'Others', 0), (2, 'Starters', 1), (3, 'Mains', 2), (4, 'Desserts', 3)
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

      // v4 migration columns: orders and bills can also exist as the
      // consolidated v4 layout (BillsModel.ensureSchema / schema-v4.sql
      // create them with snake_case + enums). The camelCase columns below
      // are then missing, and ensureColumn's "AFTER tableNumber" clauses
      // would abort the whole bootstrap because their anchor column does
      // not exist. Guard each ALTER so a failed position clause retries
      // without one.
      const ensureColumnSafe = async (tableName, columnName, definition) => {
        try {
          await ensureColumn(tableName, columnName, definition);
        } catch (err) {
          if (err.code !== "ER_BAD_FIELD_ERROR") throw err;
          const bare = definition.replace(/\s+AFTER\s+\S+(?:\s+\S+)?/i, "");
          await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${bare}`);
        }
      };

      await run(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_number VARCHAR(50) NOT NULL,
          waiter_name VARCHAR(191) DEFAULT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'pending',
          subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
          tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // The v4 layout (schema-v4.sql / OrdersModel) is authoritative when it
      // already exists; these guard ALTERs only top up a legacy camelCase
      // layout that predates the migration.
      await ensureColumnSafe("orders", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER table_number");
      await ensureColumnSafe("orders", "table_number", "VARCHAR(50) NOT NULL DEFAULT '' AFTER id");
      await ensureColumnSafe("orders", "subtotal", "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER status");
      await ensureColumnSafe("orders", "tax_amount", "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER subtotal");
      await ensureColumnSafe("orders", "total_amount", "DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER tax_amount");
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
          table_number VARCHAR(50) NOT NULL,
          entity_type VARCHAR(30) DEFAULT 'Table',
          customer_name VARCHAR(191) DEFAULT NULL,
          phone VARCHAR(30) DEFAULT NULL,
          subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
          service_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
          tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          total DECIMAL(10,2) NOT NULL DEFAULT 0,
          discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          payment_method VARCHAR(50) DEFAULT NULL,
          payment_status VARCHAR(50) DEFAULT 'unpaid',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await ensureColumnSafe("bills", "customerName", "VARCHAR(191) DEFAULT NULL AFTER table_number");
      await ensureColumnSafe("bills", "token_id", "INT DEFAULT NULL AFTER table_number");
      await ensureColumnSafe("bills", "tableNumber", "VARCHAR(50) NOT NULL DEFAULT '' AFTER id");
      await ensureColumnSafe("bills", "entityType", "VARCHAR(30) DEFAULT 'Table' AFTER table_number");
      await ensureColumnSafe("bills", "phone", "VARCHAR(30) DEFAULT NULL AFTER customerName");
      await ensureColumnSafe("bills", "invoiceStatus", "VARCHAR(50) DEFAULT 'Saved' AFTER total");
      await ensureColumnSafe("bills", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER entity_type");
      await ensureColumnSafe("bills", "split_no", "INT DEFAULT NULL AFTER invoiceStatus");
      await ensureColumnSafe("bills", "split_count", "INT DEFAULT NULL AFTER split_no");
      await ensureColumnSafe("bills", "discountAmount", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total");
      await ensureColumnSafe("bills", "paid_at", "DATETIME DEFAULT NULL AFTER split_count");
      await ensureColumnSafe("bills", "payment_id", "INT DEFAULT NULL AFTER paid_at");
      await ensureColumnSafe("bills", "account_transaction_id", "INT DEFAULT NULL AFTER payment_id");
      await ensureColumnSafe("bills", "posted_to_room", "TINYINT(1) NOT NULL DEFAULT 0 AFTER account_transaction_id");
      await ensureColumnSafe("bills", "posted_room_number", "VARCHAR(50) DEFAULT NULL AFTER posted_to_room");
      await ensureColumnSafe("bills", "room_booking_id", "INT DEFAULT NULL AFTER posted_room_number");
      await ensureColumnSafe("bills", "room_booking_code", "VARCHAR(80) DEFAULT NULL AFTER room_booking_id");
      await ensureColumnSafe("bills", "folio_entry_id", "INT DEFAULT NULL AFTER room_booking_code");
      await ensureColumnSafe("bills", "source_table_number", "VARCHAR(50) DEFAULT NULL AFTER folio_entry_id");
      await ensureColumnSafe("bills", "posted_at", "DATETIME DEFAULT NULL AFTER source_table_number");
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

      // This table ships in two layouts: the legacy camelCase one created
      // above, and a minimal pre-existing one (id, table_number, subtotal,
      // tax_amount, total, status, created_at). Guard every ALTER so the
      // missing-anchor case still tops the columns up.
      await ensureColumnSafe("restaurant_bills", "modern_bill_id", "INT DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "tableNumber", "VARCHAR(50) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "tokenId", "INT DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "entityType", "VARCHAR(30) DEFAULT 'Table' AFTER id");
      await ensureColumnSafe("restaurant_bills", "waiter_name", "VARCHAR(191) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "customerName", "VARCHAR(191) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "phone", "VARCHAR(30) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "subtotal", "DECIMAL(10,2) DEFAULT 0 AFTER id");
      await ensureColumnSafe("restaurant_bills", "gst", "DECIMAL(10,2) DEFAULT 0 AFTER id");
      await ensureColumnSafe("restaurant_bills", "discount", "DECIMAL(10,2) DEFAULT 0 AFTER id");
      await ensureColumnSafe("restaurant_bills", "total", "DECIMAL(10,2) DEFAULT 0 AFTER id");
      await ensureColumnSafe("restaurant_bills", "paymentMethod", "VARCHAR(50) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "invoiceStatus", "VARCHAR(30) DEFAULT 'unpaid' AFTER id");
      await ensureColumnSafe("restaurant_bills", "paid_at", "DATETIME DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "payment_id", "INT DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "account_transaction_id", "INT DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "posted_to_room", "TINYINT(1) NOT NULL DEFAULT 0 AFTER id");
      await ensureColumnSafe("restaurant_bills", "posted_room_number", "VARCHAR(50) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "room_booking_id", "INT DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "room_booking_code", "VARCHAR(80) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "folio_entry_id", "INT DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "source_table_number", "VARCHAR(50) DEFAULT NULL AFTER id");
      await ensureColumnSafe("restaurant_bills", "posted_at", "DATETIME DEFAULT NULL AFTER id");
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

      // waiter backfill: tokens has no "waiter" column (the live name is
      // waiter_name, and on a fresh DB the tokens table may not exist at all
      // yet), and this statement must never abort the bootstrap.
      try {
        const [tokens] = await run("SHOW TABLES LIKE 'tokens'");
        if (tokens.length) {
          const [waiterCols] = await run(`SHOW COLUMNS FROM tokens LIKE 'waiter%'`);
          const [tableCols] = await run(`SHOW COLUMNS FROM tokens LIKE 'table%'`);
          const waiterCol = waiterCols.find((c) => c.Field === "waiter_name")?.Field
            || waiterCols.find((c) => c.Field === "waiter")?.Field;
          const tokenTableCol = tableCols.find((c) => c.Field === "tableNumber")?.Field
            || tableCols.find((c) => c.Field === "table_number")?.Field;
          const orderTableCols = await run(`SHOW COLUMNS FROM orders LIKE 'table%'`).then((r) => r[0]);
          const orderTableCol = orderTableCols.find((c) => c.Field === "tableNumber")?.Field
            || orderTableCols.find((c) => c.Field === "table_number")?.Field;
          if (waiterCol && tokenTableCol && orderTableCol) {
            await run(`
              UPDATE orders o
              LEFT JOIN tokens t
                ON t.${tokenTableCol} = o.${orderTableCol}
               AND t.status = 'active'
              SET o.waiter_name = COALESCE(NULLIF(o.waiter_name, ''), t.${waiterCol})
              WHERE o.waiter_name IS NULL OR o.waiter_name = ''
            `);
          }
        }
      } catch (err) {
        console.error("[RestaurantModel] waiter_name backfill skipped:", err.message);
      }

      // ── Add serviceCharge column to bills if missing ─────────────────────
      await ensureColumnSafe("bills", "serviceCharge", "DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER subtotal");

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
    // Sync is best effort: restaurant_bills may be missing columns in a
    // minimal layout (reports tolerate it too via column probing).
    const [legacyCols] = await run("SHOW COLUMNS FROM restaurant_bills");
    const present = new Set(legacyCols.map((c) => c.Field));
    const pick = (name) => (present.has(name) ? name : null);

    const firstSyncSets = [
      pick("tableNumber") && `rb.tableNumber = COALESCE(rb.tableNumber, b.table_number)`,
      pick("tokenId") && `rb.tokenId = b.token_id`,
      pick("entityType") && `rb.entityType = b.entity_type`,
      pick("waiter_name") && `rb.waiter_name = b.waiter_name`,
      pick("customerName") && `rb.customerName = b.customer_name`,
      pick("phone") && `rb.phone = b.phone`,
      pick("subtotal") && `rb.subtotal = b.subtotal`,
      pick("serviceCharge") && `rb.serviceCharge = COALESCE(b.service_charge, 0)`,
      pick("gst") && `rb.gst = b.tax_amount`,
      pick("discount") && `rb.discount = COALESCE(b.discount_amount, 0)`,
      pick("total") && `rb.total = b.total`,
      pick("paymentMethod") && `rb.paymentMethod = b.payment_method`,
      pick("invoiceStatus") && `rb.invoiceStatus = b.payment_status`,
      pick("paid_at") && `rb.paid_at = b.paid_at`,
      pick("payment_id") && `rb.payment_id = b.payment_id`,
      pick("account_transaction_id") && `rb.account_transaction_id = b.account_transaction_id`,
      pick("posted_to_room") && `rb.posted_to_room = COALESCE(b.posted_to_room, 0)`,
      pick("posted_room_number") && `rb.posted_room_number = b.posted_room_number`,
      pick("room_booking_id") && `rb.room_booking_id = b.room_booking_id`,
      pick("room_booking_code") && `rb.room_booking_code = b.room_booking_code`,
      pick("folio_entry_id") && `rb.folio_entry_id = b.folio_entry_id`,
      pick("source_table_number") && `rb.source_table_number = b.source_table_number`,
      pick("posted_at") && `rb.posted_at = b.posted_at`,
    ]
      .filter(Boolean)
      .join(", ");
    if (firstSyncSets) {
      await run(`
        UPDATE restaurant_bills rb
        INNER JOIN bills b ON b.id = rb.modern_bill_id
        SET ${firstSyncSets}
      `);
    }

    await run(`
      SELECT b.id
      FROM bills b
      LEFT JOIN restaurant_bills rb ON rb.modern_bill_id = b.id
      WHERE rb.id IS NULL
      ORDER BY b.created_at ASC, b.id ASC
    `).then(async (r) => {
      for (const billRow of r[0]) {
        await syncLegacyRestaurantBill(connection, billRow.id);
      }
    });
    const joinSyncSets = [
      pick("tableNumber") && `rb.tableNumber = COALESCE(rb.tableNumber, bt.table_number, bb.table_number)`,
      pick("waiter_name") && `rb.waiter_name = COALESCE(rb.waiter_name, bt.waiter_name, bb.waiter_name)`,
      pick("customerName") && `rb.customerName = COALESCE(rb.customerName, bt.customer_name, bb.customer_name)`,
      pick("phone") && `rb.phone = COALESCE(rb.phone, bt.phone, bb.phone)`,
      pick("paymentMethod") && `rb.paymentMethod = COALESCE(rb.paymentMethod, bt.payment_method, bb.payment_method)`,
      pick("invoiceStatus") && `rb.invoiceStatus = COALESCE(NULLIF(rb.invoiceStatus, 'unpaid'), bt.payment_status, bb.payment_status, rb.invoiceStatus)`,
      pick("paid_at") && `rb.paid_at = COALESCE(rb.paid_at, bt.paid_at, bb.paid_at)`,
      pick("payment_id") && `rb.payment_id = COALESCE(rb.payment_id, bt.payment_id, bb.payment_id)`,
      pick("account_transaction_id") && `rb.account_transaction_id = COALESCE(rb.account_transaction_id, bt.account_transaction_id, bb.account_transaction_id)`,
      pick("posted_to_room") && `rb.posted_to_room = COALESCE(rb.posted_to_room, bt.posted_to_room, bb.posted_to_room, rb.posted_to_room)`,
      pick("posted_room_number") && `rb.posted_room_number = COALESCE(rb.posted_room_number, bt.posted_room_number, bb.posted_room_number)`,
      pick("room_booking_id") && `rb.room_booking_id = COALESCE(rb.room_booking_id, bt.room_booking_id, bb.room_booking_id)`,
      pick("room_booking_code") && `rb.room_booking_code = COALESCE(rb.room_booking_code, bt.room_booking_code, bb.room_booking_code)`,
      pick("folio_entry_id") && `rb.folio_entry_id = COALESCE(rb.folio_entry_id, bt.folio_entry_id, bb.folio_entry_id)`,
      pick("source_table_number") && `rb.source_table_number = COALESCE(rb.source_table_number, bt.source_table_number, bb.source_table_number)`,
      pick("posted_at") && `rb.posted_at = COALESCE(rb.posted_at, bt.posted_at, bb.posted_at)`,
      pick("subtotal") && `rb.subtotal = CASE WHEN COALESCE(rb.subtotal, 0) = 0 THEN COALESCE(bt.subtotal, bb.subtotal, rb.subtotal) ELSE rb.subtotal END`,
      pick("gst") && `rb.gst = CASE WHEN COALESCE(rb.gst, 0) = 0 THEN COALESCE(bt.tax_amount, bb.tax_amount, rb.gst) ELSE rb.gst END`,
      pick("discount") && `rb.discount = CASE WHEN COALESCE(rb.discount, 0) = 0 THEN COALESCE(bt.discount_amount, bb.discount_amount, rb.discount) ELSE rb.discount END`,
      pick("total") && `rb.total = CASE WHEN COALESCE(rb.total, 0) = 0 THEN COALESCE(bt.total, bb.total, rb.total) ELSE rb.total END`,
    ]
      .filter(Boolean)
      .join(", ");
    if (joinSyncSets) {
      await run(`
        UPDATE restaurant_bills rb
        LEFT JOIN bills bt ON bt.token_id = rb.tokenId
        LEFT JOIN bills bb ON bb.table_number = rb.tableNumber AND bb.entity_type = rb.entityType
        SET ${joinSyncSets}
        WHERE rb.modern_bill_id IS NULL
      `);
    }

    console.log("[RestaurantModel] Legacy bill sync complete.");
  } catch (err) {
    console.error("[RestaurantModel] Legacy bill sync failed:", err.message);
  }
};


/* ================= TABLES ================= */

exports.addTable = (data, callback) => {
  const sql = `
    INSERT INTO ${TABLES_TABLE} (number, guestCount, floor_name, section_name, seat_count, status_color, status)
    VALUES (?, ?, ?, ?, ?, ?, 'available')
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
    SET guestCount = ?, floor_name = ?, section_name = ?, seat_count = ?, status_color = ?, status = ?
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
      data.status || "available",
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
    "INSERT INTO menu_items (name, price, image_url, description, food_type, availability_status, tax, happy_hour_price, happy_hour_start, happy_hour_end) VALUES (?,?,?,?,?,?,?,?,?,?)";

  db.query(
    sql,
    [
      data.name,
      data.price,
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
    SET name=?, price=?, image_url=?, description=?, food_type=?, availability_status=?, tax=?, happy_hour_price=?, happy_hour_start=?, happy_hour_end=?
    WHERE id=?
  `;

  db.query(
    sql,
    [
      data.name,
      data.price,
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
        b.table_number AS tableNumber,
        b.token_id AS tokenId,
        t.token_code AS tokenCode,
        b.entity_type AS entityType,
        b.waiter_name,
        b.customer_name AS customerName,
        b.phone,
        b.subtotal,
        b.service_charge AS serviceCharge,
        b.tax_amount AS gst,
        b.total,
        b.discount_amount AS discountAmount,
        b.payment_method AS paymentMethod,
        b.payment_status AS invoiceStatus,
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
  // v4 orders.status enum: pending/confirmed/preparing/ready/served/completed/cancelled
  db.query("UPDATE orders SET status='completed' WHERE id=?", [orderId], callback);
};

exports.getBillById = (billId, callback) => {
  db.query(
    `
      SELECT
        b.id,
        b.table_number AS tableNumber,
        b.token_id AS tokenId,
        t.token_code AS tokenCode,
        b.entity_type AS entityType,
        b.waiter_name,
        b.customer_name AS customerName,
        b.phone,
        b.subtotal,
        b.service_charge AS serviceCharge,
        b.tax_amount AS gst,
        b.total,
        b.discount_amount AS discountAmount,
        b.payment_method AS paymentMethod,
        b.payment_status AS invoiceStatus,
        b.split_no,
        b.split_count,
        b.paid_at,
        b.paid_at AS paidAt,
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

const isSettledInvoiceStatus = (value) => {
  const normalized = normalizeInvoiceStatus(value);
  return normalized === "paid" || normalized === "posted to room";
};

// bills.payment_method is an enum; map unknown values to "other" instead of
// throwing "Data truncated" (matches the controller's normalizer).
const normalizePaymentMethod = (value) => {
  const allowed = new Set(["cash", "card", "upi", "wallet", "net_banking", "credit", "other"]);
  const s = String(value || "").toLowerCase().trim();
  if (!s) return null;
  return allowed.has(s) ? s : "other";
};

// Map legacy invoice statuses onto the v4 payment_status enum.
const mapInvoiceStatusToPaymentStatus = (status) => {
  const s = String(status || "").toLowerCase().trim();
  if (["paid", "post to room", "posted to room", "settled"].includes(s)) return "paid";
  if (["partial", "partially paid"].includes(s)) return "partial";
  if (["refunded", "refund"].includes(s)) return "refunded";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  return "unpaid";
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
          AND entity_type=?
          AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'posted to room')
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
        AND LOWER(COALESCE(payment_status, 'unpaid')) NOT IN ('paid', 'posted to room')
      ORDER BY id DESC
      LIMIT 1
    `,
    [data.table, data.entityType || "Table"],
  );

  return rows[0] || null;
};

// restaurant_bills ships in two layouts (legacy camelCase vs minimal
// snake_case); per-table column probing selects which SET/INSERT lists apply.
let legacyBillLayoutCache = null;
const legacyBillLayout = async (conn) => {
  if (legacyBillLayoutCache) return legacyBillLayoutCache;
  const [cols] = await conn.query("SHOW COLUMNS FROM restaurant_bills");
  const present = new Set(cols.map((c) => c.Field));
  const col = (name) => (present.has(name) ? name : null);
  const isFull = ["tableNumber", "tokenId", "entityType", "customerName", "paymentMethod", "invoiceStatus"].some((n) => present.has(n));
  legacyBillLayoutCache = {
    isFull,
    full: {
      sets: [
        col("tableNumber"),
        col("tokenId"),
        col("entityType"),
        col("waiter_name"),
        col("customerName"),
        col("phone"),
        col("subtotal"),
        col("gst"),
        col("discount"),
        col("total"),
        col("paymentMethod"),
        col("invoiceStatus"),
        col("paid_at"),
        col("payment_id"),
        col("account_transaction_id"),
        col("posted_to_room"),
        col("posted_room_number"),
        col("room_booking_id"),
        col("room_booking_code"),
        col("folio_entry_id"),
        col("source_table_number"),
        col("posted_at"),
      ].filter(Boolean),
    },
    minimal: {
      sets: [
        col("table_number"),
        col("tax_amount"),
        col("total"),
        col("status"),
      ].filter(Boolean),
    },
  };
  return legacyBillLayoutCache;
};

const legacyValuesFor = (layoutKey, values) => {
  const layout = layoutKey === "minimal" ? layoutKey : "full";
  const valuesMap = {
    tableNumber: values.tableNumber,
    tokenId: values.tokenId,
    entityType: values.entityType,
    waiter_name: values.waiter_name,
    customerName: values.customerName,
    phone: values.phone,
    subtotal: values.subtotal,
    gst: values.gst,
    discount: values.discount,
    total: values.total,
    paymentMethod: values.paymentMethod,
    invoiceStatus: values.invoiceStatus,
    paid_at: values.paid_at,
    payment_id: values.payment_id,
    account_transaction_id: values.account_transaction_id,
    posted_to_room: values.posted_to_room,
    posted_room_number: values.posted_room_number,
    room_booking_id: values.room_booking_id,
    room_booking_code: values.room_booking_code,
    folio_entry_id: values.folio_entry_id,
    source_table_number: values.source_table_number,
    posted_at: values.posted_at,
    created_at: values.created_at,
    // minimal-layout remaps
    table_number: values.tableNumber,
    tax_amount: values.gst,
    status: (values.invoiceStatus || "unpaid").toUpperCase(),
  };
  return legacyBillLayoutCache[layout].sets.map((s) => valuesMap[s]);
};

const findReusableLegacyBillRow = async (conn, billRow) => {
  const tokenId = Number(billRow?.tokenId || 0) || null;
  const entityType = billRow?.entityType || "Table";
  const tableNumber = billRow?.tableNumber || null;

  // The minimal restaurant_bills layout has table_number/status, not the
  // camelCase columns; probe which selector to join on.
  const [legacyCols] = await conn.query("SHOW COLUMNS FROM restaurant_bills");
  const present = new Set(legacyCols.map((c) => c.Field));
  const matchByToken = present.has("tokenId")
    ? "? IS NOT NULL AND tokenId = ? AND COALESCE(entityType, 'Table') = ?"
    : present.has("modern_bill_id")
      ? "false"
      : "";
  const matchByTable = present.has("tableNumber")
    ? "? IS NOT NULL AND tableNumber = ? AND COALESCE(entityType, 'Table') = ?"
    : present.has("table_number")
      ? "? IS NOT NULL AND table_number = ?"
      : "";

  const clauses = [matchByToken, matchByTable].filter((c) => c !== "" && c !== "false");
  if (clauses.length === 0) return null;
  const params = [];
  for (const clause of clauses) {
    if (clause.includes("tokenId")) {
      params.push(tokenId, tokenId, entityType);
    } else if (clause.includes("tableNumber")) {
      params.push(tableNumber, tableNumber, entityType);
    } else {
      params.push(tableNumber, tableNumber);
    }
  }

  const [legacyRows] = await conn.query(
    `
      SELECT *
      FROM restaurant_bills
      WHERE modern_bill_id IS NULL
        AND (
          ${clauses.join("\n          OR\n          ")}
        )
      ORDER BY created_at DESC, id DESC
    `,
    params,
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
        table_number AS tableNumber,
        token_id AS tokenId,
        entity_type AS entityType,
        waiter_name,
        customer_name AS customerName,
        phone,
        subtotal,
        service_charge AS serviceCharge,
        tax_amount AS gst,
        discount_amount AS discountAmount,
        total,
        payment_method AS paymentMethod,
        payment_status AS invoiceStatus,
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

  const layout = await legacyBillLayout(conn);
  const target = layout.isFull ? "full" : "minimal";
  const sets = legacyBillLayoutCache[target].sets;
  const paramValues = legacyValuesFor(target, {
    tableNumber: billRow.tableNumber,
    tokenId: billRow.tokenId,
    entityType: billRow.entityType,
    waiter_name: billRow.waiter_name,
    customerName: billRow.customerName,
    phone: billRow.phone,
    subtotal: Number(billRow.subtotal || 0),
    gst: Number(billRow.gst || 0),
    discount: Number(billRow.discountAmount || 0),
    total: Number(billRow.total || 0),
    paymentMethod: billRow.paymentMethod,
    invoiceStatus: billRow.invoiceStatus || "Saved",
    paid_at: billRow.paid_at,
    payment_id: billRow.payment_id,
    account_transaction_id: billRow.account_transaction_id,
    posted_to_room: Number(billRow.postedToRoom || 0),
    posted_room_number: billRow.postedRoomNumber,
    room_booking_id: billRow.roomBookingId,
    room_booking_code: billRow.roomBookingCode,
    folio_entry_id: billRow.folioEntryId,
    source_table_number: billRow.sourceTableNumber,
    posted_at: billRow.postedAt,
    created_at: billRow.created_at,
  });
  const params = [...paramValues, modernBillId];

  const [legacyRows] = await conn.query("SELECT id FROM restaurant_bills WHERE modern_bill_id = ? LIMIT 1", [modernBillId]);

  if (legacyRows?.[0]?.id) {
    await conn.query(
      `UPDATE restaurant_bills SET ${sets.map((s) => `${s} = ?`).join(", ")} WHERE modern_bill_id = ?`,
      [...paramValues, modernBillId],
    );
    return;
  }

  const reusableLegacyRow = await findReusableLegacyBillRow(conn, billRow);
  if (reusableLegacyRow?.id) {
    await conn.query(
      `
        UPDATE restaurant_bills
        SET modern_bill_id = ?, ${sets.map((s) => `${s} = ?`).join(", ")}
        WHERE id = ?
          AND modern_bill_id IS NULL
      `,
      [Number(modernBillId), ...paramValues, reusableLegacyRow.id],
    );
    return;
  }

  await conn.query(
    `
      INSERT INTO restaurant_bills (${[...sets, "modern_bill_id"].join(", ")})
      VALUES (${[...sets, "modern_bill_id"].map(() => "?").join(", ")})
    `,
    params,
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
            customer_name=?,
            phone=?,
            subtotal=?,
            service_charge=?,
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
        Number(data.serviceCharge || 0),
        Number(data.gst || 0),
        Number(data.total || 0),
        Number(data.discountAmount || 0),
        data.paymentMethod ? normalizePaymentMethod(data.paymentMethod) : null,
        mapInvoiceStatusToPaymentStatus(data.paymentStatus || data.invoiceStatus || "unpaid"),
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
  // (the bills table has a UNIQUE KEY on token_id, so a paid/closed bill
  // still holding the same token_id would cause a duplicate-key error).
  if (data.tokenId) {
    await conn.query(
      `UPDATE bills SET token_id = NULL WHERE token_id = ? AND LOWER(COALESCE(payment_status, 'unpaid')) IN ('paid')`,
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
    data.paymentMethod ? normalizePaymentMethod(data.paymentMethod) : null,
    mapInvoiceStatusToPaymentStatus(data.paymentStatus || data.invoiceStatus || "unpaid"),
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

      if (String(billRow.payment_status || "").toLowerCase() === "paid") {
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
              payment_method=?
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
          normalizePaymentMethod(data.paymentMethod || billRow.payment_method || null),
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

    // Resolve a payment-mode label to a payment_methods.id (mirrors the
// controller helper so the model needs no cross-file import).
const resolvePaymentMethodId = async (conn, paymentMode) => {
  const label = String(paymentMode || "").trim();
  if (!label) return null;
  try {
    const [rows] = await conn.query("SELECT id FROM payment_methods WHERE LOWER(name) = LOWER(?) LIMIT 1", [label]);
    if (rows && rows[0]) return rows[0].id;
    const code = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) || "other";
    const [result] = await conn.query("INSERT INTO payment_methods (name, code, is_active) VALUES (?, ?, 1)", [label, code]);
    if (result?.insertId) return result.insertId;
  } catch { /* unique-name race: fall through */ }
  const [retry] = await conn.query("SELECT id FROM payment_methods ORDER BY id ASC LIMIT 1");
  return retry?.[0]?.id || null;
};

const [paymentTables] = await conn.query("SHOW TABLES LIKE ?", [paymentsTableName]);
    if (!Array.isArray(paymentTables) || !paymentTables.length) {
      const error = new Error("Payments module is temporarily unavailable until the payments table is repaired.");
      error.statusCode = 503;
      throw error;
    }

    const [paymentResult] = await conn.query(
      `
        INSERT INTO ${paymentsTableName} (bill_id, amount, payment_method_id, payment_type, status, received_by, created_at)
        VALUES (?, ?, ?, 'payment', 'completed', ?, NOW())
      `,
      [
        billId,
        Number(billRow.total || data.total || 0),
        await resolvePaymentMethodId(conn, String(data.paymentMethod || billRow.payment_method || "Cash")),
        data.user?.id || null,
      ],
    );

    const transactionDate = new Date().toISOString().slice(0, 10);
    const entityLabel =
      String(billRow.entity_type || data.entityType || "Table").toLowerCase() === "room" ? "Room" : "Table";
    const entityRef = billRow.table_number || data.table || "--";
    const description = `Restaurant bill payment - ${entityLabel} ${entityRef} - Bill #${billId}`;

    const [accountResult] = await conn.query(
      `
        INSERT INTO accounts_transactions (date, type, description, amount, payment_mode, source_module)
        VALUES (?, 'Income', ?, ?, ?, 'restaurant')
      `,
      [transactionDate, description, Number(billRow.total || data.total || 0), data.paymentMethod || "Cash"],
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
      [normalizePaymentMethod(data.paymentMethod || billRow.payment_method || null), Number(billRow.total || data.total || 0), billId],
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

// Fresh v4 DBs have `bookings`/`booking_rooms`, not `guests`/`room_tariff`
// (or those are empty); the legacy lookup fails without an active stay and
// falls back to the modern schema. Both paths leave `booking` as
// { bookingId, bookingCode, guestName, roomNumber, status } or null.
const getRoomChargeableBooking = async (conn, roomNumber, bookingId = null) => {
  const trimmedRoomNumber = String(roomNumber || "").trim();
  if (!trimmedRoomNumber) return null;

  const legacySql = `
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
  const legacyParams = [trimmedRoomNumber];
  if (bookingId) {
    legacySql += " AND g.id = ?";
    legacyParams.push(Number(bookingId));
  }

  let booking = null;
  try {
    const [rows] = await conn.query(legacySql, legacyParams);
    booking = rows?.[0] || null;
  } catch {
    booking = null;
  }

  if (!booking) {
    const modernSql = `
      SELECT
        b.id AS bookingId,
        b.booking_code AS bookingCode,
        CONCAT_WS(' ', bg.first_name, bg.last_name) AS guestName
      FROM bookings b
      INNER JOIN booking_rooms br ON br.booking_id = b.id
      LEFT JOIN booking_guests bg ON bg.booking_id = b.id
      WHERE CAST(br.room_number AS CHAR) = CAST(? AS CHAR)
        AND b.status IN ('checked_in','confirmed','reserved')
    `;
    const modernParams = [trimmedRoomNumber];
    if (bookingId) {
      modernSql += " AND b.id = ?";
      modernParams.push(Number(bookingId));
    }
    modernSql += " ORDER BY b.id DESC, bg.id LIMIT 1";
    try {
      const [rows] = await conn.query(modernSql, modernParams);
      booking = rows?.[0] || null;
    } catch {
      booking = null;
    }
    if (booking) booking.mobile = null;
  }

  if (!booking) return null;

  const normalizedStatus = normalizeMatchValue(booking.bookingStatus || booking.status);
  const isActiveStay =
    !normalizedStatus ||
    normalizedStatus.includes("checked in") ||
    normalizedStatus.includes("occupied") ||
    normalizedStatus.includes("in house") ||
    normalizedStatus === "confirmed" ||
    normalizedStatus === "reserved";

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

    if (String(billRow.payment_status || "").toLowerCase() === "paid") {
      const error = new Error("This bill is already settled and cannot be posted to room.");
      error.statusCode = 409;
      throw error;
    }

    if (billRow.folio_entry_id) {
      const error = new Error("This bill has already been posted to a room folio.");
      error.statusCode = 409;
      throw error;
    }

    const sourceTableNumber = String(data.sourceTableNumber || billRow.source_table_number || billRow.table_number || "").trim();
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
    const description = `Restaurant charge from Table ${sourceTableNumber || billRow.table_number || "--"} | Bill #${billId}`;
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
          payment_status = 'paid',
          paid_at = NOW(),
          room_booking_id = ?,
          room_booking_code = ?,
          folio_entry_id = ?
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
    log("bill updated to posted");

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
