const Restaurant = require("../models/RestaurantModel");
const db = require("../config/db");

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

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
  Restaurant.deleteMenuItem(req.params.id, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Menu item deleted" });
  });
};

/* ================= ORDER ================= */

exports.addOrderItem = async (req, res) => {
  const { tableNumber, item } = req.body || {};
  if (!tableNumber || !item) return res.status(400).json({ message: "tableNumber and item required" });

  try {
    let created = false;
    let order = (await q("SELECT id FROM orders WHERE tableNumber=? AND status='pending' ORDER BY id DESC LIMIT 1", [tableNumber]))[0];

    if (!order) {
      const result = await q("INSERT INTO orders (tableNumber, status) VALUES (?, 'pending')", [tableNumber]);
      order = { id: result.insertId };
      created = true;
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
  try {
    const rows = await q(
      `
        SELECT
          o.id,
          o.tableNumber,
          o.status,
          o.created_at,
          COUNT(oi.id) AS itemCount,
          COALESCE(SUM(COALESCE(oi.price, 0) * COALESCE(oi.quantity, 0)), 0) AS totalAmount
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id, o.tableNumber, o.status, o.created_at
        ORDER BY o.id DESC
      `
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load orders", error: err.message });
  }
};

exports.getOrder = async (req, res) => {
  const { tableNumber } = req.params;
  try {
    const rows = await q("SELECT * FROM orders WHERE tableNumber=? AND status='pending' ORDER BY id DESC LIMIT 1", [tableNumber]);
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
  const { orderId } = req.params;
  const { status, tableNumber } = req.body || {};

  try {
    const existing = await q("SELECT id FROM orders WHERE id = ? LIMIT 1", [orderId]);
    if (!existing.length) {
      return res.status(404).json({ message: "Order not found" });
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
  const { orderId } = req.params;
  try {
    const result = await q("DELETE FROM orders WHERE id = ?", [orderId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete order", error: err.message });
  }
};

exports.payOrder = async (req, res) => {
  const { tableNumber } = req.params;
  try {
    const result = await q("UPDATE orders SET status='paid' WHERE tableNumber=? AND status='pending'", [tableNumber]);
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

    Restaurant.createBill(
      {
        table: req.body.table || req.body.tableNumber,
        tokenId: req.body.tokenId || null,
        entityType: req.body.entityType || "Table",
        waiterName: req.body.waiterName || null,
        customerName: req.body.customerName || "",
        phone: req.body.phone || "",
        subtotal: Number(req.body.subtotal || 0),
        gst: Number(req.body.gst || 0),
        total: Number(req.body.total || 0),
        discountAmount: Number(req.body.discountAmount || req.body.discount || 0),
        paymentMethod: req.body.paymentMethod || null,
        invoiceStatus: req.body.invoiceStatus || (req.body.paymentMethod ? "Paid" : "Generated"),
        splitNo: req.body.splitNo || null,
        splitCount: req.body.splitCount || null,
      },
      (err, result) => {
        if (err) {
          return res.status(500).json({ message: "Failed to create bill", error: err.message });
        }

        res.json({
          id: result?.insertId || result?.bill?.id || null,
          bill: result?.bill || null,
          message: "Bill created",
        });
      }
    );
  } catch (err) {
    res.status(500).json({ message: "Failed to create bill", error: err.message });
  }
};

exports.getBills = async (req, res) => {
  try {
    await Restaurant.ensureSchema();

    Restaurant.getBills((err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Failed to load bills", error: err.message });
      }
      res.json(Array.isArray(rows) ? rows : []);
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
      res.json(rows);
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
  const { tokenItemId, tableNumber, actionType, reason, requestedBy } = req.body || {};
  if (!tokenItemId || !tableNumber || !actionType || !reason) {
    return res.status(400).json({ message: "Missing action request fields" });
  }

  Restaurant.addItemActionRequest(
    { tokenItemId, tableNumber, actionType, reason, requestedBy },
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Item action request created", id: result.insertId });
    }
  );
};

exports.getItemActionRequests = async (req, res) => {
  try {
    await Restaurant.ensureSchema();
    Restaurant.getItemActionRequests((err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Failed to load item action requests", error: err.message });
      }
      res.json(Array.isArray(rows) ? rows : []);
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load item action requests", error: err.message });
  }
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
    Restaurant.getWaiterPerformance((err, rows) => {
      if (err) return res.json([]);
      res.json(Array.isArray(rows) ? rows : []);
    });
  } catch {
    res.json([]);
  }
};
