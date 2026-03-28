const Restaurant = require("../models/RestaurantModel");
const db   = require("../config/db");
const path = require("path");
const fs   = require("fs");


const isHappyHourActive = (item) => {
  if (!item.happy_hour_price || !item.happy_hour_start || !item.happy_hour_end) return false;
  const now = new Date();
  const current = now.toTimeString().slice(0, 8);
  return current >= item.happy_hour_start && current <= item.happy_hour_end;
};

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );


/* ================= TABLE ================= */

// ── TABLES ─────────────────────────────────────────────────────────────────
exports.addTable = async (req, res) => {
  const { number, floorName, sectionName, seatCount, statusColor } = req.body;
  if (!number) return res.status(400).json({ message: "Table number required" });
  try {
    // upsert — if number exists, just return it
    const existing = await q("SELECT * FROM restaurant_tables WHERE number = ? LIMIT 1", [String(number)]);
    if (existing.length) return res.json({ id: existing[0].id, number: String(number), message: "Already exists" });

    const result = await q(
      "INSERT INTO restaurant_tables (number, status, guestCount, floor_name, section_name, seat_count, status_color) VALUES (?, 'available', ?, ?, ?, ?, ?)",
      [String(number), Number(seatCount || 4), floorName || null, sectionName || null, Number(seatCount || 4), statusColor || null]
    );
    res.json({ id: result.insertId, number: String(number) });
  } catch (err) {
    res.status(500).json({ message: "Table insert failed", error: err.message });
  }
};

exports.getTables = async (req, res) => {
  try {
    const rows = await q("SELECT * FROM restaurant_tables ORDER BY CAST(number AS UNSIGNED), number ASC");
    // Normalize field names to match frontend expectations
    const normalized = rows.map(t => ({
      id:          t.id,
      number:      t.number,
      floorName:   t.floor_name   || t.floorName   || "",
      sectionName: t.section_name || t.sectionName || "",
      seatCount:   t.seat_count   || t.seatCount   || t.guestCount || 4,
      statusColor: t.status_color || t.statusColor || "",
      status:      t.status || "available",
    }));
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: "Failed to load tables", error: err.message });
  }
};

exports.updateTable = async (req, res) => {
  const { id } = req.params;
  const { floorName, sectionName, seatCount, statusColor, status } = req.body;
  try {
    await q(
      "UPDATE restaurant_tables SET floor_name=?, section_name=?, seat_count=?, status_color=?, status=? WHERE id=?",
      [floorName || null, sectionName || null, Number(seatCount || 4), statusColor || null, status || "available", id]
    );
    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.deleteTable = async (req, res) => {
  try {
    await q("DELETE FROM restaurant_tables WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json(err); }
};

/* ================= MENU ================= */

exports.addMenuItem = async (req, res) => {
  // handles both JSON and FormData
  const name        = req.body.name;
  const price       = Number(req.body.price);
  const category    = req.body.category || "Others";
  const tableNumber = req.body.tableNumber || null;
  const tax         = Number(req.body.tax || 5);
  const description = req.body.description || null;
  const foodType    = req.body.foodType || "Veg";
  const status      = req.body.status || "Available";

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
    let rows;
    if (tableNumber) {
      // Return items for this specific table OR global items (null table_number)
      rows = await q(
        "SELECT * FROM menu_items WHERE table_number = ? OR table_number IS NULL ORDER BY category, name",
        [String(tableNumber)]
      );
    } else {
      rows = await q("SELECT * FROM menu_items ORDER BY category, name");
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load menu", error: err.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  const { id } = req.params;
  const { name, price, category, status, description, foodType } = req.body;
  let imageUrl = req.body.imageUrl || null;
  if (req.file) imageUrl = `/uploads/${req.file.filename}`;
  try {
    await q(
      "UPDATE menu_items SET name=?, price=?, category=?, status=?, description=?, food_type=?, image_url=COALESCE(?,image_url) WHERE id=?",
      [name, price, category, status || "Available", description || null, foodType || "Veg", imageUrl, id]
    );
    res.json({ message: "Menu item updated" });
  } catch (err) { res.status(500).json(err); }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    await q("DELETE FROM menu_items WHERE id = ?", [req.params.id]);
    res.json({ message: "Menu item deleted" });
  } catch (err) { res.status(500).json(err); }
};


/* ================= ORDER ================= */

exports.addOrderItem = async (req, res) => {
  const { tableNumber, item } = req.body;
  if (!tableNumber || !item) return res.status(400).json({ message: "tableNumber and item required" });
  try {
    // Find or create pending order
    let order = (await q("SELECT id FROM orders WHERE tableNumber=? AND status='pending' ORDER BY id DESC LIMIT 1", [tableNumber]))[0];
    if (!order) {
      const r = await q("INSERT INTO orders (tableNumber, status) VALUES (?, 'pending')", [tableNumber]);
      order = { id: r.insertId };
    }
    await q(
      "INSERT INTO order_items (order_id, name, price, quantity) VALUES (?,?,?,?)",
      [order.id, item.name, Number(item.price), Number(item.quantity || 1)]
    );
    res.json({ orderId: order.id, message: "Item added" });
  } catch (err) {
    res.status(500).json({ message: "Failed to add order item", error: err.message });
  }
};

exports.getOrder = async (req, res) => {
  const { tableNumber } = req.params;
  try {
    const rows = await q("SELECT * FROM orders WHERE tableNumber=? AND status='pending' ORDER BY id DESC LIMIT 1", [tableNumber]);
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json(err); }
};

exports.getOrderItems = async (req, res) => {
  const { orderId } = req.params;
  try {
    const rows = await q("SELECT * FROM order_items WHERE order_id=?", [orderId]);
    res.json(rows);
  } catch (err) { res.status(500).json(err); }
};

exports.payOrder = async (req, res) => {
  const { tableNumber } = req.params;
  try {
    await q("UPDATE orders SET status='paid' WHERE tableNumber=? AND status='pending'", [tableNumber]);
    res.json({ message: "Order marked paid" });
  } catch (err) { res.status(500).json(err); }
};
// ── BILLS ────────────────────────────────────────────────────────────────────
exports.createBill = async (req, res) => {
  const { tableNumber, tokenId, entityType, subtotal, gst, discount, total, paymentMethod } = req.body;
  try {
    const result = await q(
      "INSERT INTO restaurant_bills (tableNumber, tokenId, entityType, subtotal, gst, discount, total, paymentMethod, invoiceStatus) VALUES (?,?,?,?,?,?,?,?,'paid')",
      [tableNumber, tokenId || null, entityType || "Table", subtotal || 0, gst || 0, discount || 0, total || 0, paymentMethod || "Cash"]
    );
    // Close the token
    if (tableNumber) {
      await q("UPDATE tokens SET status='closed' WHERE tableNumber=? AND status='active'", [tableNumber]);
    }
    res.json({ id: result.insertId, message: "Bill created" });
  } catch (err) {
    res.status(500).json({ message: "Failed to create bill", error: err.message });
  }
};

exports.getBills = async (req, res) => {
  try {
    const rows = await q("SELECT * FROM restaurant_bills ORDER BY created_at DESC LIMIT 200");
    res.json(rows);
  } catch (err) {
    // fallback to old bills table
    try {
      const rows = await q("SELECT *, tableNumber as tableNumber FROM bills ORDER BY created_at DESC LIMIT 200");
      res.json(rows);
    } catch (e) { res.status(500).json(e); }
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
    const statusCode = Number(error.statusCode || 500);
    res.status(statusCode).json({
      message: error.message || "Bill payment failed",
    });
  }
};

exports.updateMenuItem = async (req, res) => {
  const { name, price, category, tableNumber, tax, happyHourPrice, happyHourStart, happyHourEnd, description, foodType, status, existingImageUrl, imageUrl: bodyImageUrl } = req.body;
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
      },
    );
  } catch (error) {
    return res.status(500).json({ message: "Failed to prepare restaurant schema" });
  }
};

exports.deleteMenuItem = (req, res) => {
  Restaurant.deleteMenuItem(req.params.id, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Menu item deleted" });
  });
};


exports.addItemActionRequest = (req, res) => {
  const { tokenItemId, tableNumber, actionType, reason, requestedBy } = req.body || {};
  if (!tokenItemId || !tableNumber || !actionType || !reason) {
    return res.status(400).json({ message: "Missing action request fields" });
  }

  Restaurant.addItemActionRequest(
    { tokenItemId, tableNumber, actionType, reason, requestedBy },
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Item action request created", id: result.insertId });
    },
  );
};

// ── ACTION REQUESTS (used by EditToken) ───────────────────────────────────
exports.getItemActionRequests = async (req, res) => {
  // Stub — return empty if table doesn't exist yet
  res.json([]);
};


exports.reviewItemActionRequest = (req, res) => {
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
    },
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
    },
  );
};

// ── WAITER PERFORMANCE (was missing — crashes TablePage) ──────────────────
exports.getWaiterPerformance = async (req, res) => {
  try {
    const rows = await q(`
      SELECT waiter AS waiter_name,
             COUNT(*)                                              AS total_orders,
             SUM(CASE WHEN status='Ready' THEN 1 ELSE 0 END)      AS completed,
             AVG(prep_time_minutes)                                AS avg_prep_time
      FROM kitchen_orders
      WHERE token_status = 'Active'
      GROUP BY waiter
      ORDER BY total_orders DESC
    `);
    res.json(rows);
  } catch {
    res.json([]); // non-critical, return empty
  }
};