const Restaurant = require("../models/RestaurantModel");
const db = require("../config/db");
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
    await Restaurant.ensureSchema();

    // ✅ duplicate check (safe)
    const existing = await q(
      "SELECT id FROM restaurant_tables WHERE number = ? LIMIT 1",
      [String(number)]
    );

    const legacyExisting = await tableExistsInLegacyTable(number);

    if (existing.length > 0 || legacyExisting !== null) {
      return res.status(400).json({ message: "Table already exists" });
    }

    // ✅ CLEAN INSERT (guestCount removed)
 const result = await q(
  "INSERT INTO restaurant_tables (number, status, guestCount, floor_name, section_name, seat_count, status_color) VALUES (?, 'available', ?, ?, ?, ?, ?)",
  [
    String(number),
    Number(seatCount || 4),   // guestCount
    floorName || null,
    sectionName || null,
    Number(seatCount || 4),   // seat_count
    statusColor || null,
  ]
);
    res.json({
      id: result.insertId,
      number: String(number),
    });

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
    await Restaurant.ensureSchema();

    const result = await q(
      "DELETE FROM restaurant_tables WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Table not found",
      });
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
    const shouldAutoSend = autoSendEnabled && entityType !== "Room" && customerName && phone;

    let whatsappResult = null;
    if (shouldAutoSend) {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      const publicBase = (smsSettings?.public_base_url || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, "");
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

      const number = phone.replace(/[^0-9]/g, "");
      if (number && process.env.WASEND_USERNAME && process.env.WASEND_TOKEN) {
        const fetch = global.fetch || require("undici").fetch;
        const wasendUrl = new URL('https://wasend.sachiva.cloud/api/send-message');
        wasendUrl.searchParams.set('username', process.env.WASEND_USERNAME);
        wasendUrl.searchParams.set('token', process.env.WASEND_TOKEN);
        wasendUrl.searchParams.set('number', number);
        wasendUrl.searchParams.set('message', `Your restaurant bill ${billId || ''}`.trim());
        wasendUrl.searchParams.set('file_url', `${publicBase}/uploads/restaurant-bills/${fileName}`);
        wasendUrl.searchParams.set('file_name', fileName);

        const resp = await fetch(wasendUrl.toString());
        whatsappResult = await resp.json().catch(() => ({ status: 'unknown' }));
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
    const publicBase = (req.body.publicBaseUrl || smsSettings?.public_base_url || process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, "");
    const { filePath, fileName } = await generateRestaurantBillPdf({
      ...req.body,
      billNo,
      items,
      customerName,
      phone,
      createdAt: req.body.createdAt || new Date().toISOString(),
    }, { fileName: billNo ? `${billNo}` : undefined });

    const fileUrl = `${publicBase}/uploads/restaurant-bills/${fileName}`;
    const number = phone.replace(/[^0-9]/g, "");

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

    const resp = await fetch(wasendUrl.toString());
    const data = await resp.json().catch(() => null);

    return res.json({
      message: "Restaurant bill sent to WhatsApp",
      fileUrl,
      filePath,
      wasend: data || { status: 'unknown' },
    });
  } catch (error) {
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
            id,
            tableNumber,
            tokenId,
            NULL AS tokenCode,
            entityType,
            NULL AS waiter_name,
            NULL AS customerName,
            NULL AS phone,
            subtotal,
            gst,
            total,
            discount AS discountAmount,
            paymentMethod,
            invoiceStatus,
            NULL AS split_no,
            NULL AS split_count,
            NULL AS paid_at,
            NULL AS payment_id,
            NULL AS account_transaction_id,
            created_at
          FROM restaurant_bills
          ORDER BY created_at DESC
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
