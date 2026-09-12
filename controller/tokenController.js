const db = require("../config/db");
const { getRequestActor, isWaiterActor, namesMatch } = require("../utils/requestActor");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

const denyIfNotOwnedByWaiter = (record, actor, responseMessage, res) => {
  if (!isWaiterActor(actor)) return false;
  if (!record?.waiter) return false;
  if (namesMatch(record.waiter, actor.name)) return false;
  res.status(403).json({ message: responseMessage });
  return true;
};

const getActiveTokenByTable = async (tableNumber) => {
  const [rows] = await runQuery(
    `SELECT * FROM tokens WHERE table_number = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
    [tableNumber]
  );
  return rows[0] || null;
};

const buildTokenCode = () => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VIS-${stamp}-${random}`;
};

exports.createToken = async (req, res) => {
  const actor = getRequestActor(req);
  const { tableNumber, waiter } = req.body;
  const resolvedWaiter = isWaiterActor(actor) ? actor.name || waiter : waiter;

  if (!tableNumber) {
    return res.status(400).json({ message: "Table required" });
  }

  try {
    const activeToken = await getActiveTokenByTable(tableNumber);

    if (denyIfNotOwnedByWaiter(activeToken, actor, "This table is assigned to another waiter", res)) {
      return;
    }

    if (activeToken?.id) {
      const [paidBills] = await runQuery(
        `SELECT id FROM bills WHERE token_id = ? AND (LOWER(COALESCE(invoiceStatus, '')) = 'paid' OR account_transaction_id IS NOT NULL) ORDER BY id DESC LIMIT 1`,
        [activeToken.id]
      );

      if (!paidBills.length) {
        return res.json({
          message: "Token already active",
          tokenId: activeToken.id,
          tokenCode: activeToken.token_code || null,
          existing: true,
        });
      }

      await runQuery(`UPDATE tokens SET status = 'closed' WHERE id = ? AND status = 'active'`, [activeToken.id]);
    }

    const nextTokenCode = buildTokenCode();
    const [result] = await runQuery(
      `INSERT INTO tokens (token_code, table_number, waiter_name, status) VALUES (?, ?, ?, 'active')`,
      [nextTokenCode, tableNumber, resolvedWaiter]
    );

    res.json({
      message: "Token created",
      tokenId: result.insertId,
      tokenCode: nextTokenCode,
      existing: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Token creation failed" });
  }
};

exports.getTokenByTable = async (req, res) => {
  const actor = getRequestActor(req);
  const table = req.params.table;

  try {
    const token = await getActiveTokenByTable(table);
    if (denyIfNotOwnedByWaiter(token, actor, "This token belongs to another waiter", res)) return;
    res.json(token || {});
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.addItem = async (req, res) => {
  const actor = getRequestActor(req);
  const tokenId = req.body?.tokenId;

  try {
    const token = await runQuery("SELECT * FROM tokens WHERE id = ? LIMIT 1", [tokenId]).then(rows => rows[0] || null);
    if (!token) {
      return res.status(404).json({ message: "Token not found" });
    }
    if (denyIfNotOwnedByWaiter(token, actor, "You can add items only to your own token", res)) return;

    await runQuery(
      `INSERT INTO token_items (token_id, item_name, qty, rate) VALUES (?, ?, ?, ?)`,
      [tokenId, req.body?.name || "Item", req.body?.qty || 1, req.body?.price || 0]
    );

    res.json({ message: "Item added" });
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.getItems = async (req, res) => {
  const actor = getRequestActor(req);
  const tokenId = req.params.tokenId;

  try {
    const token = await runQuery("SELECT * FROM tokens WHERE id = ? LIMIT 1", [tokenId]).then(rows => rows[0] || null);
    if (!token) {
      return res.json([]);
    }
    if (denyIfNotOwnedByWaiter(token, actor, "You can view items only for your own token", res)) return;

    const data = await runQuery("SELECT * FROM token_items WHERE token_id = ?", [tokenId]);
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.updateItem = async (req, res) => {
  const actor = getRequestActor(req);

  try {
    const row = await runQuery(
      `SELECT ti.*, t.id AS token_row_id, t.table_number, t.waiter, t.status AS token_status FROM token_items ti INNER JOIN tokens t ON t.id = ti.token_id WHERE ti.id = ? LIMIT 1`,
      [req.body?.id]
    ).then(rows => rows[0] || null);
    if (!row) {
      return res.status(404).json({ message: "Token item not found" });
    }
    if (denyIfNotOwnedByWaiter(row, actor, "You can update only your own token items", res)) return;

    await runQuery(`UPDATE token_items SET qty = ?, rate = ? WHERE id = ?`, [req.body?.qty, req.body?.rate, req.body?.id]);
    res.json({ message: "Item updated" });
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.deleteItem = async (req, res) => {
  const actor = getRequestActor(req);
  const id = req.params.id;

  try {
    const row = await runQuery(
      `SELECT ti.*, t.id AS token_row_id, t.table_number, t.waiter, t.status AS token_status FROM token_items ti INNER JOIN tokens t ON t.id = ti.token_id WHERE ti.id = ? LIMIT 1`,
      [id]
    ).then(rows => rows[0] || null);
    if (!row) {
      return res.status(404).json({ message: "Token item not found" });
    }
    if (denyIfNotOwnedByWaiter(row, actor, "You can delete only your own token items", res)) return;

    await runQuery(`DELETE FROM token_items WHERE id = ?`, [id]);
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.closeTokenByTable = async (req, res) => {
  const actor = getRequestActor(req);
  const table = req.params.table;

  try {
    const token = await getActiveTokenByTable(table);
    if (denyIfNotOwnedByWaiter(token, actor, "You can close only your own token", res)) return;

    await runQuery(`UPDATE tokens SET status = 'closed' WHERE table_number = ? AND status = 'active'`, [table]);
    res.json({ message: "Token closed" });
  } catch (err) {
    res.status(500).json(err);
  }
};
