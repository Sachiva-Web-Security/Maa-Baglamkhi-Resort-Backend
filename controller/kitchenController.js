const Kitchen = require("../models/kitchen");
const AccountsModel = require("../models/AccountsModel");
const db = require("../config/db");

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

const parseItems = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

const formatMySqlDateTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const normalizeOrder = (row) => ({
  ...row,
  items:       parseItems(row.items),
  table:       String(row.table_number || row.table || ""),
  entityType:  row.entity_type || row.entityType || "Table",
  prepTimeMinutes: row.prep_time_minutes || row.prepTimeMinutes || 20,
  expectedReadyAt: row.expected_ready_at || row.expectedReadyAt || null,
  readyMessage:    row.ready_message    || row.readyMessage    || "",
});

const normalizePrepTime = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(120, Math.max(5, Math.round(parsed)));
};

const inferEntityType = (orderLike = {}) => {
  if (String(orderLike.entity_type || orderLike.entityType || "").toLowerCase() === "room") {
    return "Room";
  }

  return String(orderLike.waiter_name || orderLike.waiter || "")
    .toLowerCase()
    .includes("room")
    ? "Room"
    : "Table";
};

exports.createOrder = async (req, res) => {
  const { table, waiter, items, prepTimeMinutes, entityType, kotNo } = req.body;
  const itemsJson   = JSON.stringify(Array.isArray(items) ? items : []);
  const prepMinutes = Number(prepTimeMinutes || 20);
  const expectedAt  = new Date(Date.now() + prepMinutes * 60000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const kot = kotNo || `KOT-${Date.now()}`;

  try {
    const result = await q(
      `INSERT INTO kitchen_orders
        (waiter_name, table_number, items, status, token_status, kot_no, entity_type, prep_time_minutes, expected_ready_at)
        VALUES (?, ?, ?, 'Pending', 'Active', ?, ?, ?, ?)`,
      [waiter || "Waiter", String(table || ""), itemsJson, kot, entityType || "Table", prepMinutes, expectedAt]
    );
    res.status(201).json({ id: result.insertId, message: "Kitchen order created", kotNo: kot });
  } catch (err) {
    res.status(500).json({ message: "Failed to create kitchen order", error: err.message });
  }
};

// ── GET ORDERS ──────────────────────────────────────────────────────────────
exports.getOrders = async (req, res) => {
  try {
    const rows = await q(
      "SELECT * FROM kitchen_orders WHERE token_status != 'Closed' ORDER BY created_at DESC"
    );
    res.json(rows.map(normalizeOrder));
  } catch (err) {
    res.status(500).json({ message: "Failed to get kitchen orders", error: err.message });
  }
};

// ── UPDATE ORDER STATUS ─────────────────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, prepTimeMinutes, readyMessage } = req.body;
  try {
    const fields = [], vals = [];
    if (status !== undefined) { fields.push("status = ?"); vals.push(status); }
    if (readyMessage !== undefined) { fields.push("ready_message = ?"); vals.push(readyMessage); }
    if (prepTimeMinutes !== undefined) {
      fields.push("prep_time_minutes = ?");
      vals.push(Number(prepTimeMinutes));
      const expectedAt = new Date(Date.now() + Number(prepTimeMinutes) * 60000)
        .toISOString().slice(0, 19).replace("T", " ");
      fields.push("expected_ready_at = ?");
      vals.push(expectedAt);
    }
    if (status === "Ready") {
      fields.push("ready_at = NOW()");
    }
    if (!fields.length) return res.status(400).json({ message: "Nothing to update" });
    vals.push(id);
    await q(`UPDATE kitchen_orders SET ${fields.join(", ")} WHERE id = ?`, vals);
    res.json({ message: "Order status updated" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update order", error: err.message });
  }
};

// ── SAVE ORDER ──────────────────────────────────────────────────────────────
exports.saveOrder = async (req, res) => {
  const { id } = req.params;
  try {
    await q("UPDATE kitchen_orders SET status = 'Saved', token_status = 'Closed' WHERE id = ?", [id]);
    res.json({ message: "Order saved" });
  } catch (err) {
    res.status(500).json(err);
  }
};

// ── CANCEL ORDER ────────────────────────────────────────────────────────────
exports.cancelOrder = async (req, res) => {
  const { id } = req.params;
  try {
    await q("UPDATE kitchen_orders SET status = 'Cancelled' WHERE id = ?", [id]);
    res.json({ message: "Order cancelled" });
  } catch (err) {
    res.status(500).json(err);
  }
};

// ── REMOVE ORDER (DELETE) — FIX: was missing ───────────────────────────────
exports.removeOrder = async (req, res) => {
  const { id } = req.params;
  try {
    await q("DELETE FROM kitchen_orders WHERE id = ?", [id]);
    res.json({ message: "Order permanently removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove order", error: err.message });
  }
};
