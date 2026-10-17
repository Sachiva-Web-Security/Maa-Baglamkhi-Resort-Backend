/* Ad-hoc inspection of the restaurant token/bill data behind the payment bug. */
require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const c = await mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "resort_management",
  });

  const [tok] = await c.execute(
    "SELECT id, token_code, table_id, table_number, waiter_id, waiter_name, status, created_at FROM tokens WHERE token_code = 'VIS-20261015-8K7EQ4'"
  );
  console.log("=== token ===");
  console.table(tok);

  if (tok.length) {
    const tid = tok[0].id;
    const [ti] = await c.execute("SELECT * FROM token_items WHERE token_id = ?", [tid]);
    console.log("=== token_items (" + ti.length + ") ===");
    console.table(ti);

    const [bills] = await c.execute("SELECT * FROM bills WHERE token_id = ?", [tid]);
    console.log("=== bills for token (" + bills.length + ") ===");
    console.table(bills);
  }

  const [ord] = await c.execute(
    "SELECT id, table_number, waiter_name, entity_type, status, created_at FROM orders ORDER BY id DESC LIMIT 4"
  );
  console.log("=== recent orders ===");
  console.table(ord);

  for (const o of ord) {
    const [oi] = await c.execute("SELECT * FROM order_items WHERE order_id = ?", [o.id]);
    console.log("=== order_items for order " + o.id + " (" + oi.length + ") ===");
    console.table(oi);
  }

  const [menu] = await c.execute(
    "SELECT id, name, price, tax_percent FROM menus ORDER BY id LIMIT 12"
  );
  console.log("=== menus ===");
  console.table(menu);

  await c.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
