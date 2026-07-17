const db = require("../config/db");
const { getRequestActor, isWaiterActor, namesMatch } = require("../utils/requestActor");

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

const parseItems = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

const now = () => new Date();

// Add status columns if missing
async function ensureWaiterColumns() {
  try {
    await q("ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS picked_up_at DATETIME NULL AFTER ready_at");
  } catch {
    try { await q("ALTER TABLE kitchen_orders ADD COLUMN picked_up_at DATETIME NULL AFTER ready_at"); } catch {}
  }
  try {
    await q("ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS served_at DATETIME NULL AFTER picked_up_at");
  } catch {
    try { await q("ALTER TABLE kitchen_orders ADD COLUMN served_at DATETIME NULL AFTER picked_up_at"); } catch {}
  }
}

/**
 * GET /waiter/orders/ready
 * Returns all kitchen orders with status = 'Ready' for waiters to pickup.
 * Waiters only see their own orders; non-waiters see all.
 */
exports.getReadyOrders = async (req, res) => {
  try {
    await ensureWaiterColumns();
    const actor = getRequestActor(req);
    const rows = await q(
      `SELECT * FROM kitchen_orders WHERE status = 'Ready' AND (token_status IS NULL OR token_status != 'Closed') ORDER BY created_at ASC`
    );
    let result = rows;
    if (isWaiterActor(actor) && actor.name) {
      result = result.filter((row) => namesMatch(row.waiter_name, actor.name));
    }
    res.json(result.map(normalizeKitchenOrder));
  } catch (err) {
    res.status(500).json({ message: "Failed to load ready orders", error: err.message });
  }
};

/**
 * PATCH /waiter/orders/:id/pickup
 * Atomic pickup — only one waiter can succeed (uses UPDATE ... WHERE status='Ready').
 * Returns 409 if already picked up.
 */
exports.pickupOrder = async (req, res) => {
  try {
    await ensureWaiterColumns();
    const actor = getRequestActor(req);
    const waiterName = isWaiterActor(actor) ? actor.name : null;

    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Order id is required" });

    // First, check current state
    const existing = await q("SELECT * FROM kitchen_orders WHERE id = ? LIMIT 1", [id]);
    if (!existing.length) {
      return res.status(404).json({ message: "Kitchen order not found" });
    }

    const order = existing[0];
    if (String(order.status).toLowerCase() !== "ready") {
      return res.status(409).json({
        success: false,
        message: `Order is already ${order.status} and cannot be picked up`,
        alreadyTaken: true,
      });
    }

    // Atomic update — only succeeds if still Ready
    const updated = await q(
      `UPDATE kitchen_orders
       SET status = 'Picked Up', picked_up_at = NOW(), waiter_name = ?
       WHERE id = ? AND status = 'Ready'`,
      [waiterName || order.waiter_name, id]
    );

    if (!updated.affectedRows) {
      // Someone else picked it up between our check and update
      return res.status(409).json({
        success: false,
        message: "Order was picked up by another waiter",
        alreadyTaken: true,
      });
    }

    // Fetch the updated row
    const [fresh] = await q("SELECT * FROM kitchen_orders WHERE id = ? LIMIT 1", [id]);
    const result = normalizeKitchenOrder(fresh || order);

    // Notify via socket
    global.io?.emit("kitchen-order-updated", {
      id: result.id,
      table: result.table,
      waiter: result.waiter,
      entityType: result.entityType,
      status: "Picked Up",
    });

    res.json({ success: true, message: "Order picked up", order: result });
  } catch (err) {
    res.status(500).json({ message: "Pickup failed", error: err.message });
  }
};

/**
 * PATCH /waiter/orders/:id/served
 * Mark a picked-up order as served.
 */
exports.markServed = async (req, res) => {
  try {
    await ensureWaiterColumns();
    const actor = getRequestActor(req);
    const waiterName = isWaiterActor(actor) ? actor.name : null;

    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Order id is required" });

    const existing = await q("SELECT * FROM kitchen_orders WHERE id = ? LIMIT 1", [id]);
    if (!existing.length) {
      return res.status(404).json({ message: "Kitchen order not found" });
    }

    const order = existing[0];
    const statusLower = String(order.status).toLowerCase();
    if (statusLower !== "picked up" && statusLower !== "ready") {
      return res.status(400).json({
        success: false,
        message: `Cannot mark as served — order status is ${order.status}`,
      });
    }

    // If waiter, verify ownership
    if (isWaiterActor(actor) && actor.name) {
      const owner = String(order.waiter_name || "").trim();
      if (owner && !namesMatch(owner, actor.name)) {
        return res.status(403).json({ message: "You can only mark your own orders as served" });
      }
    }

    const updated = await q(
      `UPDATE kitchen_orders
       SET status = 'Served', served_at = NOW(), waiter_name = COALESCE(?, waiter_name)
       WHERE id = ?`,
      [waiterName || order.waiter_name, id]
    );

    if (!updated.affectedRows) {
      return res.status(404).json({ message: "Order not found" });
    }

    const [fresh] = await q("SELECT * FROM kitchen_orders WHERE id = ? LIMIT 1", [id]);
    const result = normalizeKitchenOrder(fresh || order);

    global.io?.emit("kitchen-order-updated", {
      id: result.id,
      table: result.table,
      waiter: result.waiter,
      entityType: result.entityType,
      status: "Served",
    });

    res.json({ success: true, message: "Order marked as served", order: result });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark served", error: err.message });
  }
};

/**
 * GET /waiter/live-board
 * Returns all active kitchen orders with ownership flag for the current waiter.
 */
exports.getLiveBoard = async (req, res) => {
  try {
    await ensureWaiterColumns();
    const actor = getRequestActor(req);
    const currentWaiterName = isWaiterActor(actor) ? actor.name : null;

    const rows = await q(
      `SELECT * FROM kitchen_orders
       WHERE COALESCE(token_status, 'Active') != 'Closed'
       ORDER BY created_at DESC`
    );

    const result = rows.map((row) => {
      const normalized = normalizeKitchenOrder(row);
      const ownerName = String(normalized.waiter || "").trim();
      const isOwned = currentWaiterName
        ? !ownerName || namesMatch(ownerName, currentWaiterName)
        : true;

      return {
        ...normalized,
        isOwnedByCurrentWaiter: isOwned,
        ownerName: ownerName || "Unassigned",
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to load live board", error: err.message });
  }
};

function normalizeKitchenOrder(row) {
  return {
    id: row.id,
    tableNumber: String(row.table_number || row.tableNumber || ""),
    table: String(row.table_number || row.tableNumber || ""),
    tokenId: row.id,
    waiter: row.waiter_name || row.waiter || "",
    entityType: row.entity_type || row.entityType || "Table",
    items: parseItems(row.items),
    orderStatus: row.status || "Pending",
    kitchenStatus: row.status || "Pending",
    tokenStatus: row.token_status || "Active",
    kotNo: row.kot_no || null,
    prepTimeMinutes: row.prep_time_minutes || 20,
    expectedReadyAt: row.expected_ready_at || row.expectedReadyAt || null,
    readyAt: row.ready_at || null,
    readyMessage: row.ready_message || row.readyMessage || "",
    pickedUpAt: row.picked_up_at || null,
    servedAt: row.served_at || null,
    lockedAt: row.picked_up_at || row.created_at,
    sentAt: row.created_at,
    createdAt: row.created_at || null,
  };
}
