const db = require("../config/db");
const { ensureSchema } = require("../models/kitchen");

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

const normalizeItem = (item) => ({
  name: item.name || item.item_name || "Item",
  item_name: item.item_name || item.name || "Item",
  qty: Number(item.qty ?? item.quantity ?? 1) || 1,
  quantity: Number(item.quantity ?? item.qty ?? 1) || 1,
  price: Number(item.price ?? item.rate ?? 0) || 0,
});

const insertKitchenOrderIfMissing = async ({
  kotNo,
  table,
  waiter,
  items,
  entityType = "Table",
  createdAt,
}) => {
  const existing = await q("SELECT id FROM kitchen_orders WHERE kot_no = ? LIMIT 1", [kotNo]);
  if (existing.length) return;

  await q(
    `
      INSERT INTO kitchen_orders
        (table_number, waiter_name, entity_type, items, status, token_status, kot_no, prep_time_minutes, created_at)
      VALUES (?, ?, ?, ?, 'Pending', 'Active', ?, 20, COALESCE(?, NOW()))
    `,
    [
      String(table || ""),
      waiter || "Waiter",
      entityType,
      JSON.stringify((items || []).map(normalizeItem)),
      kotNo,
      createdAt || null,
    ],
  );
};

const syncRestaurantOrdersToKitchen = async () => {
  await ensureSchema();

  const pendingOrders = await q(`
    SELECT
      o.id,
      o.tableNumber,
      COALESCE(NULLIF(o.waiter_name, ''), NULLIF(t.waiter, ''), 'Waiter') AS waiter_name,
      o.created_at
    FROM orders o
    LEFT JOIN tokens t
      ON t.tableNumber = o.tableNumber
     AND t.status = 'active'
    WHERE LOWER(COALESCE(o.status, 'pending')) = 'pending'
    ORDER BY o.id ASC
  `);

  for (const order of pendingOrders) {
    const items = await q(
      "SELECT name, name AS item_name, quantity AS qty, quantity, price FROM order_items WHERE order_id = ? ORDER BY id ASC",
      [order.id],
    );

    if (!items.length) continue;

    await insertKitchenOrderIfMissing({
      kotNo: `REST-ORDER-${order.id}`,
      table: order.tableNumber,
      waiter: order.waiter_name,
      items,
      entityType: "Table",
      createdAt: order.created_at,
    });
  }

  const activeTokens = await q(`
    SELECT
      t.id,
      t.tableNumber,
      COALESCE(NULLIF(t.waiter, ''), 'Waiter') AS waiter_name,
      t.created_at
    FROM tokens t
    LEFT JOIN orders o
      ON o.tableNumber = t.tableNumber
     AND LOWER(COALESCE(o.status, 'pending')) = 'pending'
    WHERE LOWER(COALESCE(t.status, 'active')) = 'active'
      AND o.id IS NULL
    ORDER BY t.id ASC
  `);

  for (const token of activeTokens) {
    const items = await q(
      "SELECT item_name AS name, item_name, qty, qty AS quantity, rate AS price FROM token_items WHERE token_id = ? ORDER BY id ASC",
      [token.id],
    );

    if (!items.length) continue;

    await insertKitchenOrderIfMissing({
      kotNo: `TOKEN-${token.id}`,
      table: token.tableNumber,
      waiter: token.waiter_name,
      items,
      entityType: "Table",
      createdAt: token.created_at,
    });
  }
};

module.exports = {
  syncRestaurantOrdersToKitchen,
};
