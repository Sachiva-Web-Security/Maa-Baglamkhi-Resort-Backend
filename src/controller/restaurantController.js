const db = require("../config/db");
const { getRequestActor, isWaiterActor, namesMatch } = require("../utils/requestActor");

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

const resolveAssignedWaiterName = (req, fallbackEntityType = "Table") => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor) && actor.name) {
    return actor.name;
  }

  const bodyWaiterName = String(req.body?.waiterName || req.body?.waiter || "").trim();
  if (bodyWaiterName) return bodyWaiterName;

  return String(fallbackEntityType || "Table").toLowerCase() === "room" ? "Room Service" : "Waiter";
};

const isHappyHourActive = (item) => {
  if (!item.happy_hour_price || !item.happy_hour_start || !item.happy_hour_end) return false;
  const now = new Date();
  const current = now.toTimeString().slice(0, 8);
  return current >= item.happy_hour_start && current <= item.happy_hour_end;
};

const withEffectivePrice = (item) => {
  const effectivePrice = isHappyHourActive(item)
    ? Number(item.happy_hour_price || item.happyHourPrice || item.price || 0)
    : Number(item.price || 0);

  return {
    ...item,
    effectivePrice,
    effective_price: effectivePrice,
  };
};

const normalizeTableRow = (tableRow) => ({
  id: tableRow.id,
  number: tableRow.table_number || tableRow.number,
  floorName: tableRow.floor_name || tableRow.floorName || "",
  sectionName: tableRow.section_name || tableRow.sectionName || "",
  seatCount: tableRow.seat_count || tableRow.seatCount || tableRow.guestCount || 4,
  statusColor: tableRow.status_color || tableRow.statusColor || "",
  status: tableRow.status || "available",
});

const tableExistsInLegacyTable = async (number) => {
  try {
    const rows = await q("SELECT id, number FROM tables WHERE number = ? LIMIT 1", [String(number)]);
    return rows[0] || null;
  } catch {
    return null;
  }
};

const getMergedTableRows = async () => {
  const seen = new Set();
  const merged = [];

  try {
    const restaurantRows = await q("SELECT * FROM restaurant_tables ORDER BY CAST(number AS UNSIGNED), number ASC");
    for (const row of restaurantRows) {
      const key = String(row.number || row.table_number || "").trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(normalizeTableRow(row));
      }
    }
  } catch {
    // ignore and fall back to legacy table list below
  }

  try {
    const legacyRows = await q("SELECT * FROM tables ORDER BY CAST(number AS UNSIGNED), number ASC");
    for (const row of legacyRows) {
      const key = String(row.number || "").trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(normalizeTableRow(row));
      }
    }
  } catch {
    // ignore when legacy table does not exist
  }

  return merged;
};

/* ================= TABLE ================= */
exports.addTable = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot add restaurant tables" });
  }

  const { number, floorName, sectionName, seatCount, statusColor } = req.body || {};

  if (!number) {
    return res.status(400).json({ message: "Table number required" });
  }

  try {
    const existing = await q(
      "SELECT id FROM restaurant_tables WHERE number = ? LIMIT 1",
      [String(number)]
    );

    const legacyExisting = await tableExistsInLegacyTable(number);

    if (existing.length > 0 || legacyExisting !== null) {
      return res.status(400).json({ message: "Table already exists" });
    }

    const result = await q(
      "INSERT INTO restaurant_tables (number, status, guestCount, floor_name, section_name, seat_count, status_color) VALUES (?, 'available', ?, ?, ?, ?, ?)",
      [
        String(number),
        Number(seatCount || 4),
        floorName || null,
        sectionName || null,
        Number(seatCount || 4),
        statusColor || null,
      ]
    );
    res.json({
      id: result.insertId,
      number: String(number),
    });

  } catch (err) {
    console.error("ADD TABLE ERROR:", err.sqlMessage || err.message);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Table already exists",
      });
    }

    res.status(500).json({
      message: "Table insert failed",
      error: err.message,
    });
  }
};

exports.getTables = async (req, res) => {
  try {
    const rows = await getMergedTableRows();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load tables", error: err.message });
  }
};

exports.updateTable = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot update restaurant tables" });
  }

  const { id } = req.params;
  const { floorName, sectionName, seatCount, statusColor, status } = req.body || {};

  try {
    await q(
      "UPDATE restaurant_tables SET floor_name=?, section_name=?, seat_count=?, status_color=?, status=? WHERE id=?",
      [floorName || null, sectionName || null, Number(seatCount || 4), statusColor || null, status || "available", id]
    );
    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update table", error: err.message });
  }
};

exports.deleteTable = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot remove restaurant tables" });
  }

  const { id } = req.params;

  try {
    const [tableRows] = await q(
      "SELECT id, number FROM restaurant_tables WHERE id = ? LIMIT 1",
      [id]
    );
    const tableRow = tableRows?.[0];

    if (!tableRow) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    const tableNumber = String(tableRow.number || "").trim();

    const [activeTokens] = await q(
      "SELECT id FROM tokens WHERE tableNumber = ? AND status = 'active' LIMIT 1",
      [tableNumber],
    );
    if (activeTokens?.length) {
      return res.status(409).json({
        message: "Active token wali table remove nahi ho sakti.",
      });
    }

    const [pendingOrders] = await q(
      "SELECT id FROM orders WHERE tableNumber = ? AND status = 'pending' LIMIT 1",
      [tableNumber],
    );
    if (pendingOrders?.length) {
      return res.status(409).json({
        message: "Pending order wali table remove nahi ho sakti.",
      });
    }

    const [pendingBills] = await q(
      "SELECT id FROM bills WHERE tableNumber = ? AND COALESCE(invoiceStatus, 'Saved') <> 'Paid' LIMIT 1",
      [tableNumber],
    );
    if (pendingBills?.length) {
      return res.status(409).json({
        message: "Pending bill wali table remove nahi ho sakti.",
      });
    }

    await q(
      "DELETE FROM restaurant_tables WHERE id = ?",
      [id]
    );

    res.json({ message: "Table deleted successfully" });

  } catch (err) {
    console.error("DELETE TABLE ERROR:", err.sqlMessage || err.message);

    res.status(500).json({
      message: "Failed to delete table",
      error: err.message,
    });
  }
};

/* ================= MENU ================= */

exports.addMenuItem = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot create menu items" });
  }

  try {
    const name = req.body.name;
    const price = Number(req.body.price);
    const category = req.body.category || "Others";
    const tableNumber = req.body.tableNumber || null;
    const tax = Number(req.body.tax || 5);
    const description = req.body.description || null;
    const foodType = req.body.foodType || "Veg";
    const status = req.body.status || "Available";

    if (!name || !price) return res.status(400).json({ message: "Name and price required" });

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    }

    const result = await q(
      "INSERT INTO menu_items (name, price, category, table_number, image_url, description, food_type, availability_status, tax) VALUES (?,?,?,?,?,?,?,?,?)",
      [name, price, category, tableNumber, imageUrl, description, foodType, status, tax]
    );
    res.json({ id: result.insertId, name, price, category, imageUrl, message: "Menu item added" });
  } catch (err) {
    console.error("ADD MENU ITEM ERROR:", err.sqlMessage || err.message);
    res.status(500).json({ message: "Failed to add menu item", error: err.sqlMessage || err.message });
  }
};

exports.getMenuItems = async (req, res) => {
  const { tableNumber } = req.query;
  try {
    const rows = tableNumber
      ? await q(
          `
            SELECT *
            FROM menu_items
            WHERE table_number = ?
               OR table_number IS NULL
               OR TRIM(table_number) = ''
            ORDER BY
              CASE WHEN table_number = ? THEN 0 ELSE 1 END,
              category,
              name
          `,
          [String(tableNumber), String(tableNumber)],
        )
      : await q("SELECT * FROM menu_items ORDER BY category, name");

    res.json(rows.map(withEffectivePrice));
  } catch (err) {
    res.status(500).json({ message: "Failed to load menu", error: err.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot update menu items" });
  }

  const {
    name,
    price,
    category,
    tableNumber,
    tax,
    happyHourPrice,
    happyHourStart,
    happyHourEnd,
    description,
    foodType,
    status,
    existingImageUrl,
    imageUrl: bodyImageUrl,
  } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : bodyImageUrl || existingImageUrl || null;

  if (!name || !price) {
    return res.status(400).json({ message: "Name and price required" });
  }

  try {
    await q(
      `UPDATE menu_items
       SET name=?, price=?, category=?, table_number=?, image_url=?, description=?, food_type=?, availability_status=?, tax=?, happy_hour_price=?, happy_hour_start=?, happy_hour_end=?
       WHERE id=?`,
      [
        name,
        price,
        category,
        tableNumber || null,
        imageUrl || null,
        description || null,
        foodType || "Veg",
        status || "Available",
        Number(tax || 5),
        happyHourPrice != null && happyHourPrice !== "" ? Number(happyHourPrice) : null,
        happyHourStart || null,
        happyHourEnd || null,
        req.params.id,
      ],
    );
    res.json({ message: "Menu item updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update menu item", error: err.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot delete menu items" });
  }

  try {
    await q("DELETE FROM menu_items WHERE id=?", [req.params.id]);
    res.json({ message: "Menu item deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete menu item", error: err.message });
  }
};

/* ================= ORDER ================= */

exports.addOrderItem = async (req, res) => {
  const actor = getRequestActor(req);
  const { tableNumber, item } = req.body || {};
  if (!tableNumber || !item) return res.status(400).json({ message: "tableNumber and item required" });
  const waiterName = resolveAssignedWaiterName(req);

  try {
    let created = false;
    let order = (await q("SELECT id, waiter_name FROM orders WHERE tableNumber=? AND status='pending' ORDER BY id DESC LIMIT 1", [tableNumber]))[0];

    if (isWaiterActor(actor) && order?.waiter_name && !namesMatch(order.waiter_name, actor.name)) {
      return res.status(403).json({ message: "This table is already running under another waiter" });
    }

    if (!order) {
      const result = await q(
        "INSERT INTO orders (tableNumber, waiter_name, status) VALUES (?, ?, 'pending')",
        [tableNumber, waiterName || null],
      );
      order = { id: result.insertId };
      created = true;
    } else if (!order.waiter_name && waiterName) {
      await q("UPDATE orders SET waiter_name = ? WHERE id = ?", [waiterName, order.id]);
    }

    await q(
      "INSERT INTO order_items (order_id, name, price, quantity) VALUES (?,?,?,?)",
      [order.id, item.name, Number(item.price), Number(item.quantity || 1)]
    );

    res.json({
      orderId: order.id,
      message: created ? "Order created and item added" : "Item added",
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to add order item", error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  const actor = getRequestActor(req);
  try {
    const conditions = [];
    const params = [];

    if (isWaiterActor(actor) && actor.name) {
      conditions.push("LOWER(COALESCE(o.waiter_name, '')) = LOWER(?)");
      params.push(actor.name);
    }

    const rows = await q(
      `
        SELECT
          o.id,
          o.tableNumber,
          o.waiter_name AS waiterName,
          o.status,
          o.created_at,
          COUNT(oi.id) AS itemCount,
          COALESCE(SUM(COALESCE(oi.price, 0) * COALESCE(oi.quantity, 0)), 0) AS totalAmount
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
        GROUP BY o.id, o.tableNumber, o.waiter_name, o.status, o.created_at
        ORDER BY o.id DESC
      `,
      params,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load orders", error: err.message });
  }
};

exports.getOrder = async (req, res) => {
  const actor = getRequestActor(req);
  const { tableNumber } = req.params;
  try {
    const params = [tableNumber];
    let sql = "SELECT * FROM orders WHERE tableNumber=? AND status='pending'";
    if (isWaiterActor(actor) && actor.name) {
      sql += " AND LOWER(COALESCE(waiter_name, '')) = LOWER(?)";
      params.push(actor.name);
    }
    sql += " ORDER BY id DESC LIMIT 1";
    const rows = await q(sql, params);
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ message: "Failed to load order", error: err.message });
  }
};

exports.getOrderItems = async (req, res) => {
  const { orderId } = req.params;
  try {
    const rows = await q("SELECT * FROM order_items WHERE order_id=?", [orderId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load order items", error: err.message });
  }
};

exports.updateOrder = async (req, res) => {
  const actor = getRequestActor(req);
  const { orderId } = req.params;
  const { status, tableNumber } = req.body || {};

  try {
    const existing = await q("SELECT id, waiter_name FROM orders WHERE id = ? LIMIT 1", [orderId]);
    if (!existing.length) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (isWaiterActor(actor) && existing[0]?.waiter_name && !namesMatch(existing[0].waiter_name, actor.name)) {
      return res.status(403).json({ message: "You can update only your own order" });
    }

    const fields = [];
    const values = [];

    if (status !== undefined) {
      fields.push("status = ?");
      values.push(status);
    }

    if (tableNumber !== undefined) {
      fields.push("tableNumber = ?");
      values.push(tableNumber);
    }

    if (!fields.length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    values.push(orderId);
    await q(`UPDATE orders SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ message: "Order updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update order", error: err.message });
  }
};

exports.deleteOrder = async (req, res) => {
  const actor = getRequestActor(req);
  const { orderId } = req.params;
  try {
    const existing = await q("SELECT id, waiter_name FROM orders WHERE id = ? LIMIT 1", [orderId]);
    if (!existing.length) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (isWaiterActor(actor) && existing[0]?.waiter_name && !namesMatch(existing[0].waiter_name, actor.name)) {
      return res.status(403).json({ message: "You can delete only your own order" });
    }

    const result = await q("DELETE FROM orders WHERE id = ?", [orderId]);
    res.json({ message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete order", error: err.message });
  }
};

exports.payOrder = async (req, res) => {
  const actor = getRequestActor(req);
  const { tableNumber } = req.params;
  try {
    const params = [tableNumber];
    let sql = "UPDATE orders SET status='paid' WHERE tableNumber=? AND status='pending'";
    if (isWaiterActor(actor) && actor.name) {
      sql += " AND LOWER(COALESCE(waiter_name, '')) = LOWER(?)";
      params.push(actor.name);
    }
    const result = await q(sql, params);
    if (!result.affectedRows) {
      return res.json({ message: "Order already settled" });
    }
    res.json({ message: "Order marked paid" });
  } catch (err) {
    res.status(500).json({ message: "Failed to pay order", error: err.message });
  }
};

/* ================= BILLS ================= */

const createRestaurantBill = async (data) => {
  const conn = await db.promise().getConnection();
  try {
    const reusableBill = await findReusableOpenBill(conn, data);
    if (reusableBill?.id) {
      await conn.query(
        `
          UPDATE bills
          SET token_id=?,
              waiter_name=?,
              customerName=?,
              phone=?,
              subtotal=?,
              serviceCharge=?,
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
          Number(data.serviceCharge || 0),
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

      try {
        await syncLegacyRestaurantBill(conn, reusableBill.id);
      } catch (syncErr) {
        console.error("[restaurantController] Legacy bill sync failed (non-blocking):", syncErr.message);
      }

      return { insertId: reusableBill.id, bill: null };
    }

    // Release token_id from any settled bill that would block the INSERT
    if (data.tokenId) {
      await conn.query(
        `UPDATE bills SET token_id = NULL WHERE token_id = ? AND COALESCE(invoiceStatus, 'Saved') IN ('Paid', 'Posted To Room')`,
        [Number(data.tokenId)],
      );
    }

    const sql = `
      INSERT INTO bills
      (tableNumber, token_id, entityType, waiter_name, customerName, phone, subtotal, serviceCharge, gst, total, discountAmount, paymentMethod, invoiceStatus, split_no, split_count)
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
      data.paymentMethod || null,
      data.invoiceStatus || "Saved",
      data.splitNo || null,
      data.splitCount || null,
    ]);

    try {
      await syncLegacyRestaurantBill(conn, result.insertId);
    } catch (syncErr) {
      console.error("[restaurantController] Legacy bill sync failed (non-blocking):", syncErr.message);
    }

    return { insertId: result.insertId, bill: null };
  } finally {
    conn.release();
  }
};

const buildResolvedWaiterName = (data) =>
  String(data.waiterName || "").trim() ||
  (String(data.entityType || "Table").toLowerCase() === "room" ? "Room Service" : "Waiter");

const isSettledInvoiceStatus = (value) => {
  const normalized = String(value || "Saved").toLowerCase();
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

const scoreLegacyBillCandidate = (billRow, legacyRow) => {
  const billTokenId = Number(billRow?.tokenId || 0);
  const legacyTokenId = Number(legacyRow?.tokenId || 0);
  const sameEntityType = String(legacyRow?.entityType || "").toLowerCase() === String(billRow?.entityType || "").toLowerCase();
  const sameTable = String(legacyRow?.tableNumber || "").toLowerCase() === String(billRow?.tableNumber || "").toLowerCase();
  let score = 0;

  if (billTokenId && legacyTokenId === billTokenId && sameEntityType) score += 100;
  if (sameTable && sameEntityType) score += 40;
  if (Number(legacyRow?.total || 0) === Number(billRow?.total || 0)) score += 10;
  if (Number(legacyRow?.subtotal || 0) === Number(billRow?.subtotal || 0)) score += 6;
  if (String(legacyRow?.customerName || "").toLowerCase() && String(legacyRow?.customerName || "").toLowerCase() === String(billRow?.customerName || "").toLowerCase()) score += 4;
  if (String(legacyRow?.phone || "").toLowerCase() && String(legacyRow?.phone || "").toLowerCase() === String(billRow?.phone || "").toLowerCase()) score += 4;
  if (String(legacyRow?.paymentMethod || "").toLowerCase() && String(legacyRow?.paymentMethod || "").toLowerCase() === String(billRow?.paymentMethod || "").toLowerCase()) score += 2;
  if (String(legacyRow?.invoiceStatus || "").toLowerCase() && String(legacyRow?.invoiceStatus || "").toLowerCase() === String(billRow?.invoiceStatus || "").toLowerCase()) score += 2;

  return score;
};

const pickBestLegacyBillCandidate = (billRow, legacyRows) =>
  [...legacyRows].sort((leftRow, rightRow) => {
    const scoreDiff = scoreLegacyBillCandidate(billRow, rightRow) - scoreLegacyBillCandidate(billRow, leftRow);
    if (scoreDiff !== 0) return scoreDiff;

    const billTime = new Date(billRow?.created_at || 0).getTime();
    const leftDiff = Math.abs(new Date(leftRow?.created_at || 0).getTime() - billTime);
    const rightDiff = Math.abs(new Date(rightRow?.created_at || 0).getTime() - billTime);
    if (leftDiff !== rightDiff) return leftDiff - rightDiff;

    return Number(rightRow?.id || 0) - Number(leftRow?.id || 0);
  })[0] || null;

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
      [...payload, legacyRows[0].id],
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

const processBillPayment = async (data) => {
  const conn = await db.promise().getConnection();
  const paymentsTableName = process.env.PAYMENTS_TABLE_NAME || "payments";

  try {
    await conn.beginTransaction();

    let billId = Number(data.billId || 0) || null;
    let billRow = null;

    if (!billId) {
      const lookupTokenId = Number(data.tokenId || 0) || null;
      const lookupEntityType = data.entityType || "Table";

      if (lookupTokenId) {
        const [matchedBills] = await conn.query(
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
          [lookupTokenId, lookupEntityType],
        );
        if (matchedBills?.[0]?.id) {
          billId = Number(matchedBills[0].id);
        }
      }

      if (!billId) {
        const [matchedBills] = await conn.query(
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
          [data.table || data.tableNumber, lookupEntityType],
        );
        if (matchedBills?.[0]?.id) {
          billId = Number(matchedBills[0].id);
        }
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
              serviceCharge=?,
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
          Number(data.serviceCharge ?? billRow.serviceCharge ?? 0),
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
      billId = await createRestaurantBill({
        ...data,
        paymentMethod: data.paymentMethod,
        invoiceStatus: "Paid",
      }).then(r => r.insertId);

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

  const folioModel = require("./FolioEntriesModel");
  await folioModel.ensureSchema();
  log("schema ready");

  const conn = await db.promise().getConnection();
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
      billId = await createRestaurantBill({
        table: data.table || data.tableNumber,
        tokenId: data.tokenId || null,
        entityType: data.entityType || "Table",
        waiterName: data.waiterName || null,
        customerName: data.customerName || "",
        phone: data.phone || "",
        subtotal: Number(data.subtotal || 0),
        serviceCharge: Number(data.serviceCharge || 0),
        gst: Number(data.gst || 0),
        total: Number(data.total || 0),
        discountAmount: Number(data.discountAmount || data.discount || 0),
        paymentMethod: data.paymentMethod || null,
        invoiceStatus: "Posted To Room",
        splitNo: data.splitNo || null,
        splitCount: data.splitCount || null,
      }).then(r => r.insertId);

      const [createdBills] = await conn.query("SELECT * FROM bills WHERE id = ? LIMIT 1", [billId]);
      billRow = createdBills?.[0] || null;
      log("new bill created", { billId, found: !!billRow });
    }

    if (!billRow) {
      const error = new Error("Bill not found after create");
      error.statusCode = 404;
      throw error;
    }

    if (isSettledInvoiceStatus(billRow.invoiceStatus) && !String(billRow.invoiceStatus || "").toLowerCase().includes("posted")) {
      const error = new Error("Bill already settled");
      error.statusCode = 409;
      throw error;
    }

    const roomNumber = String(data.roomNumber || data.room || "").trim();
    const targetBookingId = Number(data.bookingId || billRow.room_booking_id || 0) || null;

    let bookingRow = null;
    if (targetBookingId) {
      const [guestRows] = await conn.query(
        "SELECT id, booking_code, guest_name, booking_status FROM guests WHERE id = ? LIMIT 1",
        [targetBookingId],
      );
      bookingRow = guestRows?.[0] || null;
    }

    if (!bookingRow && roomNumber) {
      const [tariffRows] = await conn.query(
        `
          SELECT g.id AS bookingId, g.booking_code, g.guest_name, g.booking_status
          FROM guests g
          INNER JOIN room_tariff rt ON rt.booking_id = g.id
          WHERE CAST(rt.room_number AS CHAR) = CAST(? AS CHAR)
            AND LOWER(COALESCE(g.booking_status, 'confirmed')) NOT IN ('checked out', 'cancelled')
          ORDER BY
            CASE
              WHEN LOWER(COALESCE(g.booking_status, '')) LIKE '%checked in%' THEN 0
              WHEN LOWER(COALESCE(g.booking_status, '')) LIKE '%occupied%' THEN 1
              WHEN LOWER(COALESCE(g.booking_status, '')) LIKE '%in house%' THEN 2
              ELSE 3
            END,
            g.id DESC
          LIMIT 1
        `,
        [roomNumber],
      );
      bookingRow = tariffRows?.[0] || null;
    }

    if (!bookingRow) {
      const error = new Error("No active booking found for this room");
      error.statusCode = 404;
      throw error;
    }

    const resolvedBookingId = Number(bookingRow.bookingId || bookingRow.id);
    const bookingCode = bookingRow.booking_code || "";
    const guestName = bookingRow.guest_name || "";

    const folioEntryId = await folioModel.createFolioEntry({
      bookingId: resolvedBookingId,
      bookingCode,
      guestName,
      roomNumber,
      description: `Restaurant - ${billRow.tableNumber || "Table"} (Bill #${billId})`,
      debit: Number(billRow.total || data.total || 0),
      credit: 0,
      transactionType: "charge",
      sourceModule: "restaurant",
      sourceRefId: billId,
      sourceRefType: "restaurant_bill",
    });

    const [paymentResult] = await conn.query(
      `
        INSERT INTO ${paymentsTableName} (tableNumber, total, paymentMethod, bookingId)
        VALUES (?, ?, ?, ?)
      `,
      [
        billRow.tableNumber || null,
        Number(billRow.total || data.total || 0),
        data.paymentMethod || billRow.paymentMethod || "Credit",
        resolvedBookingId,
      ],
    );

    const [accountResult] = await conn.query(
      `
        INSERT INTO accounts_transactions (date, type, department, description, amount, payment_mode, source_module)
        VALUES (?, 'Income', 'Restaurant', ?, ?, ?, ?)
      `,
      [
        new Date().toISOString().slice(0, 10),
        `Restaurant bill posted to room ${roomNumber} - Bill #${billId}`,
        Number(billRow.total || data.total || 0),
        data.paymentMethod || "Credit",
        "restaurant",
      ],
    );

    await conn.query(
      `
        UPDATE bills
        SET invoiceStatus='Posted To Room',
            paymentMethod=?,
            paid_at=NOW(),
            payment_id=?,
            account_transaction_id=?,
            room_booking_id=?,
            room_booking_code=?,
            folio_entry_id=?,
            posted_to_room=1,
            posted_room_number=?,
            posted_at=NOW()
        WHERE id=?
      `,
      [
        data.paymentMethod || billRow.paymentMethod || "Credit",
        paymentResult.insertId,
        accountResult.insertId,
        resolvedBookingId,
        bookingCode,
        folioEntryId,
        roomNumber,
        billId,
      ],
    );

    await syncLegacyRestaurantBill(conn, billId);

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

    await conn.commit();

    log("charge complete", {
      billId,
      bookingId: resolvedBookingId,
      folioEntryId,
      paymentId: paymentResult.insertId,
      accountTransactionId: accountResult.insertId,
    });

    return {
      billId,
      bookingId: resolvedBookingId,
      bookingCode,
      guestName,
      roomNumber,
      folioEntryId,
      paymentId: paymentResult.insertId,
      accountTransactionId: accountResult.insertId,
      postedAt: new Date().toISOString(),
    };
  } catch (error) {
    await conn.rollback();
    log("charge ERROR", { message: error?.message, sqlMessage: error?.sqlMessage });
    throw error;
  } finally {
    conn.release();
  }
};

exports.createBill = async (req, res) => {
  try {
    const actor = getRequestActor(req);

    const result = await createRestaurantBill({
      table: req.body.table || req.body.tableNumber,
      tokenId: req.body.tokenId || null,
      entityType: req.body.entityType || "Table",
      waiterName: isWaiterActor(actor) ? actor.name || req.body.waiterName || null : req.body.waiterName || null,
      customerName: req.body.customerName || "",
      phone: req.body.phone || "",
      subtotal: Number(req.body.subtotal || 0),
      gst: Number(req.body.gst || 0),
      total: Number(req.body.total || 0),
      discountAmount: Number(req.body.discountAmount || req.body.discount || 0),
      serviceCharge: Number(req.body.serviceCharge || 0),
      paymentMethod: req.body.paymentMethod || null,
      invoiceStatus: req.body.invoiceStatus || (req.body.paymentMethod ? "Paid" : "Generated"),
      splitNo: req.body.splitNo || null,
      splitCount: req.body.splitCount || null,
    });

    res.json({
      id: result.insertId || null,
      message: "Bill created",
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create bill", error: err.message });
  }
};

exports.getBills = async (req, res) => {
  try {
    const rows = await q(
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
          b.serviceCharge,
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
        ORDER BY b.created_at DESC
        LIMIT 200
      `
    );
    const actor = getRequestActor(req);
    let resultRows = rows;
    if (isWaiterActor(actor) && actor.name) {
      resultRows = rows.filter((row) => namesMatch(row.waiter_name, actor.name));
    }
    res.json(resultRows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load bills", error: err.message });
  }
};

exports.getBillById = async (req, res) => {
  try {
    const [bill] = await q(
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
          b.serviceCharge,
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
        WHERE b.id = ?
        LIMIT 1
      `,
      [req.params.id],
    );
    res.json(bill || {});
  } catch (err) {
    res.status(500).json({ message: "Failed to load bill", error: err.message });
  }
};

exports.payBill = async (req, res) => {
  try {
    const actor = getRequestActor(req);
    const result = await processBillPayment({
      ...req.body,
      billId: req.body?.billId || req.params?.id || null,
    });

    // Auto-print restaurant bill receipt after payment
    setImmediate(async () => {
      try {
        const { RestaurantPrintService } = require("../services/RestaurantPrintService");
        const { InvoicePrintService } = require("../services/InvoicePrintService");

        const [billForPrint] = await q("SELECT * FROM bills WHERE id = ? LIMIT 1", [result.billId]);
        const tokenItemsRows = await q(
          "SELECT item_name, qty, rate FROM token_items WHERE token_id = (SELECT token_id FROM bills WHERE id = ?)",
          [result.billId],
        );

        const billItems = tokenItemsRows.length > 0
          ? tokenItemsRows.map((r) => ({ name: r.item_name, qty: Number(r.qty || 1), rate: Number(r.rate || 0) }))
          : (req.body.items || []);

        const printPayload = {
          ...result,
          invoiceNo: String(result.billId || ""),
          items: billItems,
          subtotal: Number(billForPrint?.subtotal || req.body.subtotal || 0),
          gst: Number(billForPrint?.gst || req.body.gst || 0),
          serviceCharge: Number(billForPrint?.serviceCharge || req.body.serviceCharge || 0),
          discount: Number(billForPrint?.discountAmount || billForPrint?.discount || req.body.discountAmount || 0),
          discountAmount: Number(billForPrint?.discountAmount || billForPrint?.discount || req.body.discountAmount || 0),
          customerName: req.body.customerName || req.body.customer_name || billForPrint?.customerName || "Walk-in Customer",
          phone: req.body.phone || req.body.customer_phone || billForPrint?.phone || "",
          tableNumber: req.body.tableNumber || req.body.table || billForPrint?.tableNumber || "",
          roomNumber: req.body.roomNumber || req.body.room || "",
          paymentMethod: req.body.paymentMethod || req.body.payment_method || billForPrint?.paymentMethod || "Cash",
          printedBy: actor.name || actor.email || "System",
          waiter: billForPrint?.waiter_name || req.body.waiterName || "",
        };

        // Print thermal POS receipt (itemized with SGST/CGST)
        await RestaurantPrintService.immediatePrintRestaurantBill(printPayload);

        // Also print A4 copy
        await InvoicePrintService.immediatePrintInvoice("restaurant_bill_a4", {
          ...result,
          ...printPayload,
          customerName: printPayload.customerName,
          tableNumber: printPayload.tableNumber,
          roomNumber: printPayload.roomNumber,
          paymentMode: printPayload.paymentMethod,
          printedBy: printPayload.printedBy,
        });
      } catch (err) {
        console.error("[auto-print] restaurant bill print failed:", err.message);
      }
    });

    res.json({
      message: "Bill payment successful",
      ...result,
    });
  } catch (error) {
    res.status(Number(error.statusCode || 500)).json({
      message: error.message || "Bill payment failed",
    });
  }
};

exports.chargeBillToRoom = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot charge bill to room" });
  }

  console.log("[chargeBillToRoom] incoming body keys:", Object.keys(req.body || {}));
  console.log("[chargeBillToRoom] billId:", req.body?.billId, "params.id:", req.params?.id, "roomNumber:", req.body?.roomNumber);

  try {
    const result = await chargeBillToRoom({
      ...req.body,
      billId: req.body?.billId || req.params?.id || null,
    });

    res.json({
      message: "Bill posted to room successfully",
      ...result,
    });
  } catch (error) {
    console.error("[chargeBillToRoom] ERROR:", error?.message, error?.sqlMessage);
    res.status(Number(error.statusCode || 500)).json({
      message: error.message || "Unable to post bill to room",
    });
  }
};

/* ================= ITEM ACTION / SPLIT / METRICS ================= */

exports.addItemActionRequest = async (req, res) => {
  const actor = getRequestActor(req);
  const { tokenItemId, tableNumber, actionType, reason, requestedBy } = req.body || {};
  if (!tokenItemId || !tableNumber || !actionType || !reason) {
    return res.status(400).json({ message: "Missing action request fields" });
  }

  try {
    const result = await q(
      `
        INSERT INTO restaurant_item_action_requests
        (token_item_id, table_number, action_type, reason, requested_by, status)
        VALUES (?, ?, ?, ?, ?, 'Pending')
      `,
      [
        tokenItemId,
        tableNumber,
        actionType,
        reason,
        isWaiterActor(actor) ? actor.name || requestedBy : requestedBy,
      ],
    );
    res.json({ message: "Item action request created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Failed to create action request", error: err.message });
  }
};

exports.getItemActionRequests = async (req, res) => {
  try {
    const rows = await q(
      `
        SELECT *
        FROM restaurant_item_action_requests
        ORDER BY created_at DESC, id DESC
      `
    );
    const actor = getRequestActor(req);
    let resultRows = rows;
    if (isWaiterActor(actor) && actor.name) {
      resultRows = rows.filter((row) => namesMatch(row.requested_by, actor.name));
    }
    res.json(resultRows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load item action requests", error: err.message });
  }
};

exports.reviewItemActionRequest = async (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot review action requests" });
  }

  const { id } = req.params;
  const { status, managerNote, approvedBy } = req.body || {};
  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  try {
    await q(
      `
        UPDATE restaurant_item_action_requests
        SET status=?, manager_note=?, approved_by=?
        WHERE id=?
      `,
      [status, managerNote || null, approvedBy || null, id],
    );
    res.json({ message: "Item action request updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update action request", error: err.message });
  }
};

exports.createSplitBill = async (req, res) => {
  const traceId = `csb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[createSplitBill ${traceId}] request body keys:`, Object.keys(req.body || {}));
  console.log(`[createSplitBill ${traceId}] tableNumber:`, req.body?.tableNumber, "splitLabel:", req.body?.splitLabel, "splitNo:", req.body?.splitNo, "splitCount:", req.body?.splitCount);

  const {
    tableNumber,
    entityType,
    splitLabel,
    splitNo,
    splitCount,
    subtotal,
    gst,
    total,
    paymentMethod,
    items,
    billId,
  } = req.body || {};

  if (!tableNumber || !splitLabel || !splitNo || !splitCount) {
    return res.status(400).json({ message: "Missing split bill fields" });
  }

  console.log(`[createSplitBill ${traceId}] inserting split bill`);
  const startTime = Date.now();

  try {
    const result = await q(
      `
        INSERT INTO restaurant_split_bills
        (bill_id, table_number, entity_type, split_label, split_no, split_count, subtotal, gst, total, payment_method, items_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        billId || null,
        tableNumber,
        entityType || "Table",
        splitLabel,
        splitNo,
        splitCount,
        Number(subtotal || 0),
        Number(gst || 0),
        Number(total || 0),
        paymentMethod || null,
        JSON.stringify(items || []),
      ],
    );
    const elapsed = Date.now() - startTime;
    console.log(`[createSplitBill ${traceId}] success after ${elapsed}ms, insertId:`, result?.insertId);
    res.json({ message: "Split bill saved", id: result.insertId });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[createSplitBill ${traceId}] ERROR after ${elapsed}ms:`, err.message);
    res.status(500).json({ message: "Failed to create split bill", error: err.message });
  }
};

exports.getWaiterPerformance = async (req, res) => {
  try {
    const rows = await q(
      `
        SELECT
          COALESCE(NULLIF(TRIM(waiter_name), ''), 'Waiter') AS waiterName,
          COUNT(*) AS billsHandled,
          COALESCE(SUM(total), 0) AS salesTotal,
          COALESCE(AVG(total), 0) AS avgBillValue
        FROM bills
        GROUP BY COALESCE(NULLIF(TRIM(waiter_name), ''), 'Waiter')
        ORDER BY salesTotal DESC, billsHandled DESC
      `
    );
    const actor = getRequestActor(req);
    let resultRows = rows;
    if (isWaiterActor(actor) && actor.name) {
      resultRows = rows.filter((row) => namesMatch(row.waiterName, actor.name));
    }
    res.json(resultRows);
  } catch {
    res.json([]);
  }
};
