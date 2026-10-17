const db = require("../config/db");
const {
  getRequestActor,
  isWaiterActor,
  namesMatch,
} = require("../utils/requestActor");

/**
 * Read the waiter who owns a row.
 *
 * The `tokens` table stores the owner in `waiter_name`, but the earlier code
 * only looked at `record.waiter`, so the guard always concluded "no owner"
 * and rejected the legitimate owner with "This token belongs to another
 * waiter". Kitchen orders and restaurant orders use `waiter_name` too, so the
 * same accessor serves every one of them.
 */
const rowWaiterName = (record) =>
  String(
    record?.waiter_name ?? record?.waiterName ?? record?.waiter ?? "",
  ).trim();

/**
 * Deny a waiter touching a row they do not own.
 *
 * Rules:
 *  - Non-waiters (manager, admin, chef) are never restricted — they operate
 *    across tables, so a blanket ownership check here blocked manager orders.
 *  - A row with no owner is claimable by anyone; only a row owned by someone
 *    else is denied.
 */
const denyIfNotOwnedByWaiter = (record, actor, responseMessage, res) => {
  if (!isWaiterActor(actor)) return false;
  const owner = rowWaiterName(record);
  if (!owner) return false;
  if (namesMatch(owner, actor.name)) return false;
  res.status(403).json({ message: responseMessage });
  return true;
};

const getActiveTokenByTable = async (tableNumber) => {
  const [rows] = await db.query(
    `SELECT * FROM tokens WHERE table_number = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
    [String(tableNumber)],
  );
  return rows[0] || null;
};

const buildTokenCode = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VIS-${stamp}-${random}`;
};

/**
 * Resolve the waiter who owns a token.
 *
 * Order of precedence: the authenticated waiter (the one person actually
 * placing the order) → an explicit waiter on the token already on this table
 * → the waiter name supplied by the client. Without this, tokens created
 * through the manager interface landed unowned and could not be claimed.
 */
const resolveTokenWaiter = async (actor, fallbackName, existingToken) => {
  if (isWaiterActor(actor) && actor.name) return actor.name;
  const onTable = existingToken ? rowWaiterName(existingToken) : "";
  if (onTable) return onTable;
  return String(fallbackName || "").trim() || null;
};

exports.createToken = async (req, res) => {
  const actor = getRequestActor(req);
  const { tableNumber, waiter } = req.body;

  if (!tableNumber) {
    return res.status(400).json({ message: "Table required" });
  }

  try {
    const activeToken = await getActiveTokenByTable(tableNumber);
    const resolvedWaiter = await resolveTokenWaiter(actor, waiter, activeToken);

    if (
      denyIfNotOwnedByWaiter(
        activeToken,
        actor,
        "This table is assigned to another waiter",
        res,
      )
    ) {
      return;
    }

    if (activeToken?.id) {
      // `bills` has no invoiceStatus / account_transaction_id columns — the
      // payment state lives in payment_status, so the settled check had to
      // read that or the token could never be recycled.
      const [paidBills] = await db.query(
        `SELECT id FROM bills
         WHERE token_id = ? AND LOWER(COALESCE(payment_status, '')) = 'paid'
         ORDER BY id DESC LIMIT 1`,
        [activeToken.id],
      );

      if (!paidBills.length) {
        return res.json({
          message: "Token already active",
          tokenId: activeToken.id,
          tokenCode: activeToken.token_code || null,
          existing: true,
        });
      }

      // 'closed' is not in the tokens.status ENUM (active/completed/cancelled/
      // expired); writing it rejected the request. Use the completed state.
      await db.query(
        `UPDATE tokens SET status = 'completed', updated_at = NOW() WHERE id = ? AND status = 'active'`,
        [activeToken.id],
      );
    }

    const nextTokenCode = buildTokenCode();
    const [result] = await db.query(
      `INSERT INTO tokens (token_code, table_number, waiter_name, status, updated_at)
       VALUES (?, ?, ?, 'active', NOW())`,
      [nextTokenCode, String(tableNumber), resolvedWaiter],
    );

    res.json({
      message: "Token created",
      tokenId: result.insertId,
      tokenCode: nextTokenCode,
      waiterName: resolvedWaiter,
      existing: false,
    });
  } catch (err) {
    console.error(
      "[token/createToken] ERROR:",
      err?.sqlMessage || err?.message,
    );
    res
      .status(500)
      .json({ message: "Token creation failed", error: err.message });
  }
};

exports.getTokenByTable = async (req, res) => {
  const actor = getRequestActor(req);
  const table = req.params.table;

  try {
    const token = await getActiveTokenByTable(table);
    if (
      denyIfNotOwnedByWaiter(
        token,
        actor,
        "This token belongs to another waiter",
        res,
      )
    )
      return;
    res.json(token || {});
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load token", error: err.message });
  }
};

exports.addItem = async (req, res) => {
  const actor = getRequestActor(req);
  const tokenId = req.body?.tokenId;

  if (!tokenId) {
    return res.status(400).json({ message: "tokenId is required" });
  }

  try {
    const [tokenRows] = await db.query(
      "SELECT * FROM tokens WHERE id = ? LIMIT 1",
      [tokenId],
    );
    const token = tokenRows[0] || null;
    if (!token) {
      return res.status(404).json({ message: "Token not found" });
    }
    if (
      denyIfNotOwnedByWaiter(
        token,
        actor,
        "You can add items only to your own token",
        res,
      )
    )
      return;

    const qty = Math.max(1, Math.round(Number(req.body?.qty || 1) || 1));
    // The client sends `rate` for token items — the old code read `price`,
    // so every added line was silently stored at 0.00.
    const rate = Number(req.body?.rate ?? req.body?.price ?? 0);

    const [result] = await db.query(
      `INSERT INTO token_items (token_id, item_name, qty, rate, updated_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [tokenId, String(req.body?.name || "Item").slice(0, 191), qty, rate],
    );

    res.json({ message: "Item added", id: result.insertId, qty, rate });
  } catch (err) {
    console.error("[token/addItem] ERROR:", err?.sqlMessage || err?.message);
    res
      .status(500)
      .json({ message: "Item could not be added", error: err.message });
  }
};

exports.getItems = async (req, res) => {
  const actor = getRequestActor(req);
  const tokenId = req.params.tokenId;

  try {
    const [tokenRows] = await db.query(
      "SELECT * FROM tokens WHERE id = ? LIMIT 1",
      [tokenId],
    );
    const token = tokenRows[0] || null;
    if (!token) {
      return res.json([]);
    }
    if (
      denyIfNotOwnedByWaiter(
        token,
        actor,
        "You can view items only for your own token",
        res,
      )
    )
      return;

    const [items] = await db.query(
      "SELECT * FROM token_items WHERE token_id = ? ORDER BY id ASC",
      [tokenId],
    );
    res.json(items);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load items", error: err.message });
  }
};

exports.updateItem = async (req, res) => {
  const actor = getRequestActor(req);

  try {
    const [rows] = await db.query(
      `SELECT ti.*, t.id AS token_row_id, t.table_number, t.waiter_name, t.status AS token_status
         FROM token_items ti
         INNER JOIN tokens t ON t.id = ti.token_id
        WHERE ti.id = ? LIMIT 1`,
      [req.body?.id],
    );
    const row = rows[0] || null;
    if (!row) {
      return res.status(404).json({ message: "Token item not found" });
    }
    if (
      denyIfNotOwnedByWaiter(
        row,
        actor,
        "You can update only your own token items",
        res,
      )
    )
      return;

    const qty = Math.max(
      1,
      Math.round(Number(req.body?.qty ?? row.qty ?? 1) || 1),
    );
    const rate = Number(req.body?.rate ?? row.rate ?? 0);

    await db.query(
      "UPDATE token_items SET qty = ?, rate = ?, updated_at = NOW() WHERE id = ?",
      [qty, rate, req.body?.id],
    );
    res.json({ message: "Item updated" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Item could not be updated", error: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  const actor = getRequestActor(req);
  const id = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT ti.*, t.id AS token_row_id, t.table_number, t.waiter_name, t.status AS token_status
         FROM token_items ti
         INNER JOIN tokens t ON t.id = ti.token_id
        WHERE ti.id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0] || null;
    if (!row) {
      return res.status(404).json({ message: "Token item not found" });
    }
    if (
      denyIfNotOwnedByWaiter(
        row,
        actor,
        "You can delete only your own token items",
        res,
      )
    )
      return;

    const [result] = await db.query("DELETE FROM token_items WHERE id = ?", [
      id,
    ]);
    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Token item not found" });
    }
    res.json({ message: "Item deleted" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Item could not be deleted", error: err.message });
  }
};

exports.closeTokenByTable = async (req, res) => {
  const actor = getRequestActor(req);
  const table = req.params.table;

  try {
    const token = await getActiveTokenByTable(table);
    if (
      denyIfNotOwnedByWaiter(
        token,
        actor,
        "You can close only your own token",
        res,
      )
    )
      return;

    // 'closed' is not a valid tokens.status value — see createToken above.
    const [result] = await db.query(
      `UPDATE tokens SET status = 'completed', updated_at = NOW()
       WHERE table_number = ? AND status = 'active'`,
      [String(table)],
    );
    res.json({ message: "Token closed", closed: result.affectedRows });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Token could not be closed", error: err.message });
  }
};
