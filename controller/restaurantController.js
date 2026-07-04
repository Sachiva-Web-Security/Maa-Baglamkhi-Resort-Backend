const Restaurant = require("../models/RestaurantModel");
const db = require("../config/db");
const FbTable = require("../models/fbTableModel");
const FbTableGroup = require("../models/fbTableGroupModel");
const { getRequestActor, isWaiterActor, namesMatch } = require("../utils/requestActor");
const { generateRestaurantBillPdf } = require("../utils/restaurantBillPdf");
const { getSettings: getSmsSettings } = require("../models/fbOwnerSmsSettingsModel");

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

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/$/, "");

const normalizeTableNumber = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";

  const prefixed = raw.match(/^([A-Z]+)0+(\d+)$/);
  if (prefixed) {
    return `${prefixed[1]}${prefixed[2]}`;
  }

  if (/^\d+$/.test(raw)) {
    return String(Number(raw));
  }

  return raw;
};

const normalizeSectionName = (value) => String(value || "").trim().toUpperCase();

const getCanonicalFbTableName = (number, sectionName = "") => {
  const normalizedNumber = normalizeTableNumber(number);
  if (!normalizedNumber) return "";

  if (/^[TGPR]\d+$/.test(normalizedNumber)) return normalizedNumber;

  const section = normalizeSectionName(sectionName);
  const plain = normalizedNumber.replace(/^0+/, "") || "0";

  if (section === "GARDEN") return `G${plain}`;
  if (section === "PARSAL") return `P${plain}`;
  if (section === "ROOM DINING") return `R${plain}`;
  return `T${plain}`;
};

const getFbTableGroupId = async (sectionName = "") => {
  const section = normalizeSectionName(sectionName);
  if (!section) return null;

  try {
    await FbTableGroup.ensureSchema();
    const rows = await q("SELECT id FROM fb_table_groups WHERE UPPER(name) = ? LIMIT 1", [section]);
    return rows?.[0]?.id || null;
  } catch {
    return null;
  }
};

const resolvePublicBaseUrl = async (req, smsSettings = null, overrideBaseUrl = "") => {
  const direct = normalizeBaseUrl(
    overrideBaseUrl || smsSettings?.public_base_url || process.env.PUBLIC_BASE_URL,
  );
  if (direct) return direct;

  const forwardedHost = req.headers["x-forwarded-host"] || req.get("x-forwarded-host");
  const forwardedProto = req.headers["x-forwarded-proto"] || req.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return normalizeBaseUrl(`${forwardedProto}://${forwardedHost}`);
  }

  try {
    const fetch = global.fetch || require("undici").fetch;
    const response = await fetch("http://127.0.0.1:4040/api/tunnels");
    if (response.ok) {
      const tunnels = await response.json().catch(() => null);
      const tunnel = Array.isArray(tunnels?.tunnels)
        ? tunnels.tunnels.find((entry) => String(entry?.proto || "").toLowerCase() === "https")
          || tunnels.tunnels.find((entry) => String(entry?.proto || "").toLowerCase() === "http")
        : null;
      if (tunnel?.public_url) {
        return normalizeBaseUrl(tunnel.public_url);
      }
    }
  } catch {
    // Ignore ngrok lookup failures and fall through to the request host fallback.
  }

  return normalizeBaseUrl(`${req.protocol}://${req.get("host")}`);
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
  number: getCanonicalFbTableName(tableRow.table_number || tableRow.number || "", tableRow.section_name || tableRow.section || tableRow.table_group_name || ""),
  floorName: tableRow.floor_name || tableRow.floorName || "",
  sectionName: tableRow.section_name || tableRow.sectionName || "",
  seatCount: tableRow.seat_count || tableRow.seatCount || tableRow.guestCount || 4,
  statusColor: tableRow.status_color || tableRow.statusColor || "",
  status: tableRow.status || "available",
});

const normalizeGroupTableRow = (tableRow) => ({
  id: tableRow.id,
  number: getCanonicalFbTableName(tableRow.name || tableRow.number || tableRow.table_number || "", tableRow.table_group_name || tableRow.sectionName || tableRow.section || ""),
  floorName: tableRow.floor_name || tableRow.floorName || "",
  sectionName: tableRow.table_group_name || tableRow.sectionName || tableRow.section || "",
  seatCount: tableRow.capacity || tableRow.seat_count || tableRow.seatCount || 4,
  statusColor: tableRow.status_color || tableRow.statusColor || "",
  status: tableRow.status || "available",
});








const tableExistsInLegacyTable = async (number) => {
  try {
    const rows = await q("SELECT id, number FROM tables");
    const target = normalizeTableNumber(number);
    return rows.find((row) => normalizeTableNumber(row.number) === target) || null;
  } catch {
    return null;
  }
};

const tableExistsInRestaurantTables = async (number, ignoreId = null) => {
  try {
    const rows = await q("SELECT id, number FROM restaurant_tables");
    const target = normalizeTableNumber(number);
    return rows.find((row) => {
      if (ignoreId && Number(row.id) === Number(ignoreId)) return false;
      return normalizeTableNumber(row.number) === target;
    }) || null;
  } catch {
    return null;
  }
};

const tableExistsInFbTables = async (number, ignoreId = null) => {
  try {
    const rows = await FbTable.list();
    const target = normalizeTableNumber(number);
    return rows.find((row) => {
      if (ignoreId && Number(row.id) === Number(ignoreId)) return false;
      return normalizeTableNumber(row.name || row.number) === target;
    }) || null;
  } catch {
    return null;
  }
};

const getMergedTableRows = async () => {
  const seen = new Set();
  const merged = [];

  try {
    const groupedRows = await FbTable.list();
    for (const row of groupedRows) {
      const canonical = getCanonicalFbTableName(row.name || row.number || row.table_number || "", row.table_group_name || row.sectionName || row.section || "");
      const key = String(canonical || getCanonicalFbTableName(row.name || row.number || "")).toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(normalizeGroupTableRow(row));
      }
    }
  } catch {
    // ignore and fall back to restaurant/legacy table list below
  }

  try {
    const restaurantRows = await q("SELECT * FROM restaurant_tables ORDER BY CAST(number AS UNSIGNED), number ASC");
    for (const row of restaurantRows) {
      const canonical = getCanonicalFbTableName(row.number || row.table_number || "", row.section_name || row.section || "");
      const key = String(canonical).toLowerCase();
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
      const canonical = getCanonicalFbTableName(row.number || "", row.section_name || row.section || "");
      const key = String(canonical).toLowerCase();
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

// Ensure final canonical dedupe and normalize numbers before returning to caller
const finalizeMergedRows = (rows) => {
  const out = [];
  const seen2 = new Set();
  for (const r of rows) {
    const canonical = getCanonicalFbTableName(r.number || r.name || "", r.sectionName || r.section || "");
    const key = String(canonical).toLowerCase();
    if (!key) continue;
    if (seen2.has(key)) continue;
    seen2.add(key);
    out.push({ ...r, number: canonical });
  }
  return out;
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

  const normalizedNumber = normalizeTableNumber(number);
  if (!normalizedNumber) {
    return res.status(400).json({ message: "Table number required" });
  }

  try {
    await Restaurant.ensureSchema();

    const canonicalName = getCanonicalFbTableName(normalizedNumber, sectionName);
    if (!canonicalName) return res.status(400).json({ message: "Table number required" });

    const existing = await tableExistsInRestaurantTables(canonicalName);
    const legacyExisting = await tableExistsInLegacyTable(canonicalName);
    const fbExisting = await tableExistsInFbTables(canonicalName);

    if (existing || legacyExisting !== null || fbExisting) {
      return res.status(400).json({ message: "Table already exists" });
    }

    const tableGroupId = await getFbTableGroupId(sectionName);
    const created = await FbTable.create({
      table_group_id: tableGroupId,
      name: canonicalName,
      capacity: Number(seatCount || 4),
      status: 'available',
      is_active: 1,
    });

    res.json({ id: created.id, number: created.name });

  } catch (err) {
    console.error("🔥 ADD TABLE ERROR:", err.sqlMessage || err.message);

    // ✅ duplicate DB error handle
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
    const final = finalizeMergedRows(rows);
    res.json(final);
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
  const { number, floorName, sectionName, seatCount, statusColor, status } = req.body || {};

  try {
    const existingRow = await FbTable.getById(id);
    if (!existingRow) return res.status(404).json({ message: "Table not found" });

    const nextCanonical = getCanonicalFbTableName(number || existingRow.name || existingRow.number || "", sectionName || existingRow.table_group_name || "");
    if (!nextCanonical) return res.status(400).json({ message: "Table number required" });

    const duplicateRow = await tableExistsInRestaurantTables(nextCanonical, id);
    const legacyDuplicate = await tableExistsInLegacyTable(nextCanonical);
    const fbDuplicate = await tableExistsInFbTables(nextCanonical, id);
    if (duplicateRow || legacyDuplicate || fbDuplicate) {
      return res.status(400).json({ message: "Table number already exists" });
    }

    const tableGroupId = await getFbTableGroupId(sectionName || existingRow.table_group_name || "");
    await FbTable.update(id, {
      table_group_id: tableGroupId,
      name: nextCanonical,
      capacity: Number(seatCount || 4),
      status: status || 'available',
      is_active: 1,
    });

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
    // prefer admin fb_tables removal
    const removed = await FbTable.remove(id);
    if (!removed) {
      return res.status(404).json({ message: "Table not found" });
    }
    res.json({ message: "Table deleted successfully" });

  } catch (err) {
    console.error("🔥 DELETE TABLE ERROR:", err.sqlMessage || err.message);

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

  try {
    const result = await q(
      "INSERT INTO menu_items (name, price, category, table_number, image_url, description, food_type, status, tax) VALUES (?,?,?,?,?,?,?,?,?)",
      [name, price, category, tableNumber, imageUrl, description, foodType, status, tax]
    );
    res.json({ id: result.insertId, name, price, category, imageUrl, message: "Menu item added" });
  } catch (err) {
    res.status(500).json({ message: "Failed to add menu item", error: err.message });
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
    await Restaurant.ensureSchema();
    Restaurant.updateMenuItem(
      req.params.id,
      { name, price, category, tableNumber, imageUrl, description, foodType, status, tax, happyHourPrice, happyHourStart, happyHourEnd },
      (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Menu item updated" });
      }
    );
  } catch {
    res.status(500).json({ message: "Failed to prepare restaurant schema" });
  }
};

exports.deleteMenuItem = (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot delete menu items" });
  }

  Restaurant.deleteMenuItem(req.params.id, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Menu item deleted" });
  });
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
  const { status, tableNumber, items } = req.body || {};

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

    // Handle item quantity updates if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.orderItemId && item.quantity !== undefined) {
          await q("UPDATE order_items SET quantity = ? WHERE id = ? AND order_id = ?", [
            Number(item.quantity || 1),
            item.orderItemId,
            orderId
          ]);
        }
      }
      res.json({ message: "Order and item quantities updated" });
      return;
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
  const { itemId } = req.body || {};
  try {
    // If itemId is provided in body, delete only that item from order
    if (itemId) {
      const [order] = await q("SELECT id, waiter_name FROM orders WHERE id = ? LIMIT 1", [orderId]);
      if (!order.length) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (isWaiterActor(actor) && order[0]?.waiter_name && !namesMatch(order[0].waiter_name, actor.name)) {
        return res.status(403).json({ message: "You can modify only your own order" });
      }
      await q("DELETE FROM order_items WHERE id = ? AND order_id = ?", [itemId, orderId]);
      return res.json({ message: "Item deleted from order" });
    }

    // Otherwise delete the entire order
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

exports.removeOrderItem = async (req, res) => {
  const actor = getRequestActor(req);
  const { orderId } = req.params;
  const { itemId } = req.body || {};
  try {
    // Get the order to verify ownership
    const [order] = await q("SELECT id, waiter_name FROM orders WHERE id = ? LIMIT 1", [orderId]);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (isWaiterActor(actor) && order.waiter_name && !namesMatch(order.waiter_name, actor.name)) {
      return res.status(403).json({ message: "You can modify only your own order" });
    }

    if (itemId) {
      // Remove specific item
      await q("DELETE FROM order_items WHERE id = ? AND order_id = ?", [itemId, orderId]);
      res.json({ message: "Item removed from order" });
    } else {
      res.status(400).json({ message: "itemId is required" });
    }
  } catch (err) {
    res.status(500).json({ message: "Failed to remove item", error: err.message });
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

exports.createBill = async (req, res) => {
  try {
    await Restaurant.ensureSchema();
    const actor = getRequestActor(req);
    const entityType = String(req.body.entityType || "Table");
    const customerName = String(req.body.customerName || "").trim();
    const phone = String(req.body.phone || "").trim();

    if (entityType !== "Room" && (!customerName || !phone)) {
      return res.status(400).json({ message: "Customer name and phone number are required to generate the bill" });
    }

    const billPayload = {
      table: req.body.table || req.body.tableNumber,
      tokenId: req.body.tokenId || null,
      entityType,
      waiterName: isWaiterActor(actor) ? actor.name || req.body.waiterName || null : req.body.waiterName || null,
      customerName,
      phone,
      subtotal: Number(req.body.subtotal || 0),
      gst: Number(req.body.gst || 0),
      total: Number(req.body.total || 0),
      discountAmount: Number(req.body.discountAmount || req.body.discount || 0),
      paymentMethod: req.body.paymentMethod || null,
      invoiceStatus: req.body.invoiceStatus || (req.body.paymentMethod ? "Paid" : "Generated"),
      splitNo: req.body.splitNo || null,
      splitCount: req.body.splitCount || null,
    };

    const result = await new Promise((resolve, reject) => {
      Restaurant.createBill(billPayload, (err, saved) => {
        if (err) return reject(err);
        resolve(saved);
      });
    });

    const billId = result?.insertId || result?.bill?.id || null;
    let bill = result?.bill || null;

    if (billId) {
      const [billRows] = await db.promise().query("SELECT * FROM bills WHERE id=? LIMIT 1", [billId]);
      bill = billRows?.[0] || bill;
    }

    const smsSettings = await getSmsSettings().catch(() => null);
    const autoSendEnabled = !!smsSettings?.auto_send_restaurant_bill;
    const forceWhatsApp = !!req.body.forceSendWhatsApp;
    const shouldAutoSend = entityType !== "Room" && customerName && phone && (autoSendEnabled || forceWhatsApp) && !req.body.skipAutoSend;

    let whatsappResult = null;
    if (shouldAutoSend) {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      const publicBase = await resolvePublicBaseUrl(req, smsSettings, req.body.publicBaseUrl);
      const { filePath, fileName } = await generateRestaurantBillPdf(
        {
          ...bill,
          id: billId,
          billNo: billId,
          customerName,
          phone,
          items,
          createdAt: bill?.created_at || new Date().toISOString(),
        },
        { fileName: `restaurant-bill-${billId || Date.now()}` },
      );

      let number = phone.replace(/[^0-9]/g, "");
      // Add country code if missing (India: +91)
      if (number.length === 10 && !number.startsWith('91')) {
        number = '91' + number;
      }

      if (number && process.env.WASEND_USERNAME && process.env.WASEND_TOKEN) {
        const fetch = global.fetch || require("undici").fetch;
        const wasendUrl = new URL('https://wasend.sachiva.cloud/api/send-message');
        wasendUrl.searchParams.set('username', process.env.WASEND_USERNAME);
        wasendUrl.searchParams.set('token', process.env.WASEND_TOKEN);
        wasendUrl.searchParams.set('number', number);
        wasendUrl.searchParams.set('message', `Your restaurant bill ${billId || ''}`.trim());
        wasendUrl.searchParams.set('file_url', `${publicBase}/uploads/restaurant-bills/${fileName}`);
        wasendUrl.searchParams.set('file_name', fileName);

        console.log('Auto-sending WhatsApp message with URL:', wasendUrl.toString());

        const resp = await fetch(wasendUrl.toString());
        whatsappResult = await resp.json().catch(() => ({ status: 'unknown' }));
        console.log('Auto WhatsApp API response:', { status: resp.status, whatsappResult });
      } else {
        whatsappResult = { status: 'skipped', reason: !number ? 'No phone number' : 'WASend credentials missing' };
      }

      if (bill) {
        bill.restaurantBillPdf = { filePath, fileName };
        bill.whatsapp = whatsappResult;
      }
    }

    res.json({
      id: billId,
      bill,
      whatsapp: whatsappResult,
      message: "Bill created",
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create bill", error: err.message });
  }
};

exports.sendBillToWhatsApp = async (req, res) => {
  try {
    const customerName = String(req.body.customerName || "").trim();
    const phone = String(req.body.phone || "").trim();
    const billNo = String(req.body.billNo || req.body.billId || req.body.id || "").trim();
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!customerName || !phone) {
      return res.status(400).json({ message: "Customer name and phone number are required to send the bill" });
    }

    const fetch = global.fetch || require("undici").fetch;
    const smsSettings = await getSmsSettings().catch(() => null);
    const publicBase = await resolvePublicBaseUrl(req, smsSettings, req.body.publicBaseUrl);
    const { filePath, fileName } = await generateRestaurantBillPdf({
      ...req.body,
      billNo,
      items,
      customerName,
      phone,
      createdAt: req.body.createdAt || new Date().toISOString(),
    }, { fileName: billNo ? `${billNo}` : undefined });

    const fileUrl = `${publicBase}/uploads/restaurant-bills/${fileName}`;
    let number = phone.replace(/[^0-9]/g, "");

    // Add country code if missing (India: +91)
    if (number.length === 10 && !number.startsWith('91')) {
      number = '91' + number;
    }

    if (!number) {
      return res.status(400).json({ message: "Valid phone number required" });
    }

    if (!process.env.WASEND_USERNAME || !process.env.WASEND_TOKEN) {
      return res.status(500).json({ message: "WASend credentials missing" });
    }

    const wasendUrl = new URL('https://wasend.sachiva.cloud/api/send-message');
    wasendUrl.searchParams.set('username', process.env.WASEND_USERNAME);
    wasendUrl.searchParams.set('token', process.env.WASEND_TOKEN);
    wasendUrl.searchParams.set('number', number);
    wasendUrl.searchParams.set('message', `Your restaurant bill ${billNo || ''}`.trim());
    wasendUrl.searchParams.set('file_url', fileUrl);
    wasendUrl.searchParams.set('file_name', fileName);

    console.log('Sending WhatsApp message with URL:', wasendUrl.toString());

    const resp = await fetch(wasendUrl.toString());
    const data = await resp.json().catch(() => null);
    console.log('WhatsApp API response:', { status: resp.status, data });

    // Check if WhatsApp API returned an error
    if (resp.status >= 400 || data?.status === 'error' || data?.error) {
      return res.status(400).json({
        message: "Failed to send WhatsApp message",
        wasend: data || { status: 'error', error: `HTTP ${resp.status}` },
        fileUrl,
        filePath,
      });
    }

    return res.json({
      message: "Restaurant bill sent to WhatsApp",
      fileUrl,
      filePath,
      wasend: data || { status: 'success' },
    });
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return res.status(500).json({ message: error.message || "Failed to send restaurant bill to WhatsApp" });
  }
};

exports.getBills = async (req, res) => {
  try {
    await Restaurant.ensureSchema();
    const actor = getRequestActor(req);

    Restaurant.getBills((err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Failed to load bills", error: err.message });
      }
      let resultRows = Array.isArray(rows) ? rows : [];
      if (isWaiterActor(actor) && actor.name) {
        resultRows = resultRows.filter((row) => namesMatch(row.waiter_name, actor.name));
      }
      res.json(resultRows);
    });
  } catch {
    try {
      const rows = await q(
        `
          SELECT
            b.id,
            b.tableNumber,
            b.token_id AS tokenId,
            NULL AS tokenCode,
            b.entityType,
            b.waiter_name,
            b.customerName,
            b.phone,
            b.subtotal,
            b.gst,
            b.total,
            b.discount AS discountAmount,
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
          ORDER BY b.id DESC
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
  }
};

exports.payBill = async (req, res) => {
  try {
    const result = await Restaurant.processBillPayment({
      ...req.body,
      billId: req.body?.billId || req.params?.id || null,
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

// Pay bill by table number (called from POS when no saved bill exists)
exports.payBillByTableNumber = async (req, res) => {
  const { tableNumber } = req.params;
  const { paymentMethod, amount } = req.body || {};
  try {
    // Find the most recent unpaid bill for this table
    const [bill] = await q(
      `SELECT id FROM bills
       WHERE tableNumber = ? AND (invoiceStatus IS NULL OR invoiceStatus = '' OR invoiceStatus = 'pending')
       ORDER BY id DESC LIMIT 1`,
      [tableNumber]
    );

    if (!bill) {
      return res.status(404).json({ message: "No unpaid bill found for this table" });
    }

    // Process payment using the bill ID
    const result = await Restaurant.processBillPayment({
      billId: bill.id,
      paymentMethod: paymentMethod || "Cash",
      amount: amount || null,
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

  try {
    const result = await Restaurant.chargeBillToRoom({
      ...req.body,
      billId: req.body?.billId || req.params?.id || null,
    });

    res.json({
      message: "Bill posted to room successfully",
      ...result,
    });
  } catch (error) {
    res.status(Number(error.statusCode || 500)).json({
      message: error.message || "Unable to post bill to room",
    });
  }
};

/* ================= ITEM ACTION / SPLIT / METRICS ================= */

exports.addItemActionRequest = (req, res) => {
  const actor = getRequestActor(req);
  const { tokenItemId, tableNumber, actionType, reason, requestedBy } = req.body || {};
  if (!tokenItemId || !tableNumber || !actionType || !reason) {
    return res.status(400).json({ message: "Missing action request fields" });
  }

  Restaurant.addItemActionRequest(
    {
      tokenItemId,
      tableNumber,
      actionType,
      reason,
      requestedBy: isWaiterActor(actor) ? actor.name || requestedBy : requestedBy,
    },
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Item action request created", id: result.insertId });
    }
  );
};

exports.getItemActionRequests = async (req, res) => {
  try {
    await Restaurant.ensureSchema();
    const actor = getRequestActor(req);
    Restaurant.getItemActionRequests((err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Failed to load item action requests", error: err.message });
      }
      let resultRows = Array.isArray(rows) ? rows : [];
      if (isWaiterActor(actor) && actor.name) {
        resultRows = resultRows.filter((row) => namesMatch(row.requested_by, actor.name));
      }
      res.json(resultRows);
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load item action requests", error: err.message });
  }
};

exports.reviewItemActionRequest = (req, res) => {
  const actor = getRequestActor(req);
  if (isWaiterActor(actor)) {
    return res.status(403).json({ message: "Waiter cannot review action requests" });
  }

  const { id } = req.params;
  const { status, managerNote, approvedBy } = req.body || {};
  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  Restaurant.updateItemActionRequestStatus(
    id,
    { status, managerNote, approvedBy },
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Item action request updated" });
    }
  );
};

exports.createSplitBill = (req, res) => {
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

  Restaurant.createSplitBill(
    {
      billId,
      tableNumber,
      entityType,
      splitLabel,
      splitNo,
      splitCount,
      subtotal: Number(subtotal || 0),
      gst: Number(gst || 0),
      total: Number(total || 0),
      paymentMethod: paymentMethod || null,
      itemsJson: JSON.stringify(items || []),
    },
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Split bill saved", id: result.insertId });
    }
  );
};

exports.getWaiterPerformance = async (req, res) => {
  try {
    await Restaurant.ensureSchema();
    const actor = getRequestActor(req);
    Restaurant.getWaiterPerformance((err, rows) => {
      if (err) return res.json([]);
      let resultRows = Array.isArray(rows) ? rows : [];
      if (isWaiterActor(actor) && actor.name) {
        resultRows = resultRows.filter((row) => namesMatch(row.waiterName, actor.name));
      }
      res.json(resultRows);
    });
  } catch {
    res.json([]);
  }
};

/* ================= DASHBOARD SUMMARY ================= */

exports.getDashboardSummary = async (req, res) => {
  const { from, to } = req.query;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = from || today;
    const dateTo = to || today;

    // Query bills table
    const billRows = await q(
      `
        SELECT
          COALESCE(SUM(subtotal), 0) AS totalSubtotal,
          COALESCE(SUM(gst), 0) AS totalGST,
          COALESCE(SUM(discountAmount), 0) AS totalDiscount,
          COUNT(*) AS totalBillCount,
          COALESCE(SUM(total), 0) AS totalSale,
          entityType,
          invoiceStatus
        FROM bills
        WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
        GROUP BY entityType, invoiceStatus
      `,
      [dateFrom, dateTo]
    );

    // Query kitchen_orders table
    const kotRows = await q(
      `
        SELECT
          COUNT(*) AS totalOrders,
          SUM(CASE WHEN status IN ('Pending', 'In Progress') THEN 1 ELSE 0 END) AS activeOrders
        FROM kitchen_orders
        WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
      `,
      [dateFrom, dateTo]
    );

    // Aggregate bill results
    let totalTableSale = 0;
    let totalCounterSale = 0;
    let totalParcelSale = 0;
    let totalGST = 0;
    let totalDiscount = 0;
    let totalBillCount = 0;

    for (const row of billRows) {
      const entity = String(row.entityType || "").toLowerCase();
      if (entity === "counter") {
        totalCounterSale += Number(row.totalSubtotal || 0);
      } else if (entity === "parcel" || entity === "takeaway" || entity === "take away") {
        totalParcelSale += Number(row.totalSubtotal || 0);
      } else {
        // Default to table sale for "Table", "Room", or unspecified
        totalTableSale += Number(row.totalSubtotal || 0);
      }
      totalGST += Number(row.totalGST || 0);
      totalDiscount += Number(row.totalDiscount || 0);
      totalBillCount += Number(row.totalBillCount || 0);
    }

    const kotData = kotRows[0] || {};
    const kitchenOrdersCount = Number(kotData.totalOrders || 0);
    const kitchenActiveOrders = Number(kotData.activeOrders || 0);
    const averageOrderValue = totalBillCount > 0
      ? Number((totalTableSale + totalCounterSale + totalParcelSale) / totalBillCount).toFixed(2)
      : 0;

    res.json({
      totalTableSale: Number(totalTableSale).toFixed(2),
      totalCounterSale: Number(totalCounterSale).toFixed(2),
      totalParcelSale: Number(totalParcelSale).toFixed(2),
      totalGST: Number(totalGST).toFixed(2),
      totalDiscount: Number(totalDiscount).toFixed(2),
      totalBillCount,
      kitchenOrdersCount,
      kitchenActiveOrders,
      averageOrderValue,
      dateFrom,
      dateTo,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load dashboard summary", error: err.message });
  }
};

/* ================= FILTERED BILLS ================= */

exports.getFilteredBills = async (req, res) => {
  const { from, to, tableNumber, status } = req.query;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = from || today;
    const dateTo = to || today;

    const conditions = ["DATE(b.created_at) >= ?", "DATE(b.created_at) <= ?"];
    const params = [dateFrom, dateTo];

    if (tableNumber) {
      conditions.push("b.tableNumber = ?");
      params.push(String(tableNumber));
    }

    if (status) {
      conditions.push("b.invoiceStatus = ?");
      params.push(String(status));
    }

    const rows = await q(
      `
        SELECT
          b.id,
          b.tableNumber,
          b.token_id AS tokenId,
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
          b.created_at
        FROM bills b
        WHERE ${conditions.join(" AND ")}
        ORDER BY b.created_at DESC
        LIMIT 500
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load filtered bills", error: err.message });
  }
};

/* ================= KOT HISTORY ================= */

exports.getFilteredKotHistory = async (req, res) => {
  const { from, to, tableNumber, kotNo } = req.query;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = from || today;
    const dateTo = to || today;

    const conditions = ["DATE(created_at) >= ?", "DATE(created_at) <= ?"];
    const params = [dateFrom, dateTo];

    if (tableNumber) {
      conditions.push("table_number = ?");
      params.push(String(tableNumber));
    }

    if (kotNo) {
      conditions.push("kot_no = ?");
      params.push(String(kotNo));
    }

    const rows = await q(
      `
        SELECT
          id,
          kot_no,
          table_number,
          waiter_name,
          items,
          status,
          created_at,
          entity_type
        FROM kitchen_orders
        WHERE ${conditions.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT 500
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load KOT history", error: err.message });
  }
};

/* ================= TOP SELLING ITEMS ================= */

exports.getTopSellingItems = async (req, res) => {
  const { from, to } = req.query;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = from || today;
    const dateTo = to || today;

    const rows = await q(
      `
        SELECT items_json
        FROM restaurant_split_bills rsb
        LEFT JOIN bills b ON rsb.bill_id = b.id
        WHERE b.created_at >= ? AND b.created_at <= ?
          AND rsb.items_json IS NOT NULL
          AND rsb.items_json != ''
          AND rsb.items_json != '[]'
      `,
      [`${dateFrom} 00:00:00`, `${dateTo} 23:59:59`]
    );

    const itemTotals = {};

    for (const row of rows) {
      let items = row.items_json;
      if (!items) continue;

      if (typeof items === "string") {
        try {
          items = JSON.parse(items);
        } catch {
          continue;
        }
      }

      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const name = String(item.name || item.itemName || "").trim();
        if (!name) continue;

        const quantity = Number(item.quantity || item.qty || 1);
        const price = Number(item.price || item.rate || 0);

        if (!itemTotals[name]) {
          itemTotals[name] = { name, totalQuantity: 0, totalAmount: 0 };
        }
        itemTotals[name].totalQuantity += quantity;
        itemTotals[name].totalAmount += price * quantity;
      }
    }

    const sortedItems = Object.values(itemTotals)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 50)
      .map((item) => ({
        name: item.name,
        totalQuantity: item.totalQuantity,
        totalAmount: Number(item.totalAmount).toFixed(2),
      }));

    res.json(sortedItems);
  } catch (err) {
    res.status(500).json({ message: "Failed to load top selling items", error: err.message });
  }
};
