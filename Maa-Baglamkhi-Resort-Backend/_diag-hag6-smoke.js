/* Smoke test: restaurant model + controller against the live v4 DB (resort_management).
   Run: DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD= DB_NAME=resort_management node _diag-hag6-smoke.js
   Cleans up its own rows. Exits 0 on success. */
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "root";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "";
process.env.DB_NAME = process.env.DB_NAME || "resort_management";

const assert = require("assert");
const m = require("./src/models/RestaurantModel");
const ctrl = require("./src/controller/restaurantController");
const db = require("./src/config/db");

// reads -> first element of the [rows, fields] tuple; writes -> bare ResultSetHeader
const q = async (sql, params = []) => {
  const result = await db.query(sql, params);
  return Array.isArray(result) ? result[0] : result;
};
const cb = (fn) => new Promise((resolve, reject) => fn((err, r) => (err ? reject(err) : resolve(r))));

const fakeRes = () => {
  const res = {
    status(c) { res.code = c; return res; },
    json(b) { res.body = b; return res; },
  };
  return res;
};

(async () => {
  let failures = 0;
  const step = async (name, fn) => {
    try {
      await fn();
      console.log("OK  ", name);
    } catch (err) {
      failures += 1;
      console.log("FAIL", name, "-", err.message);
      throw err;
    }
  };

  const T1 = "HAG6S1";
  const T3 = "HAG6S3";

  await step("cleanup previous run", async () => {
    await q("DELETE FROM bills WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM orders WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM tokens WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM restaurant_tables WHERE number IN (?)", [[T1, T3]]);
    await q("DELETE FROM restaurant_split_bills WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM menu_items WHERE name='HAG6 Smoke Item'");
  });

  await step("model: createOrder/getPendingOrder/markOrderPaid (table_number, completed)", async () => {
    const res = await q("INSERT INTO orders (table_number, status) VALUES (?, 'pending')", [T1]);
    assert(res.insertId > 0);
    const pending = await cb((f) => m.getPendingOrder(T1, f));
    assert(pending && String(pending.table_number) === T1);
    await cb((f) => m.markOrderPaid(pending.id, f));
    const o = await q("SELECT status FROM orders WHERE id=?", [pending.id]);
    assert.strictEqual(o[0].status, "completed");
  });

  await step("model: createBill reuses open bill; writes payment_method/total", async () => {
    const base = { table: T1, customerName: "Smoke Guest", subtotal: 10, serviceCharge: 1, gst: 2, total: 13, paymentMethod: "Cash", invoiceStatus: "Saved" };
    const r1 = await cb((f) => m.createBill(base, f));
    const r2 = await cb((f) => m.createBill({ ...base, total: 15 }, f));
    assert.strictEqual(r2.insertId, r1.insertId, "second createBill should reuse the open bill");
    const b = await q("SELECT total, payment_method, payment_status FROM bills WHERE id=?", [r1.insertId]);
    assert.strictEqual(Number(b[0].total), 15);
    assert.strictEqual(b[0].payment_method, "cash");
  });

  await step("model: getBills/getBillById aliases", async () => {
    const list = await cb((f) => m.getBills(f));
    assert(Array.isArray(list));
    const rows = await q("SELECT id FROM bills WHERE table_number=? ORDER BY id DESC LIMIT 1", [T1]);
    const one = await cb((f) => m.getBillById(rows[0].id, f));
    assert.strictEqual(one.tableNumber, T1, `tableNumber alias missing: ${Object.keys(one).join(",")}`);
    assert(one.invoiceStatus !== undefined);
  });

  await step("model: processBillPayment (payments + accounts_transactions + status paid)", async () => {
    // fresh unpaid bill: processBillPayment on an already-paid bill is a 409 by design
    await q("INSERT INTO bills (table_number, total, payment_method, payment_status) VALUES (?, 20, 'cash', 'unpaid')", [T1]);
    const rows = await q("SELECT id FROM bills WHERE table_number=? AND payment_status='unpaid' ORDER BY id DESC LIMIT 1", [T1]);
    // processBillPayment is promise-style; it ignores a callback (and a bare
    // callback wrapper would swallow its rejection - it returns undefined).
    const res = await m.processBillPayment({ billId: rows[0].id, paymentMethod: "UPI", total: 20 });
    assert(res.paymentId > 0, "payment id returned");
    const b = await q("SELECT payment_status, paid_amount, payment_method, total FROM bills WHERE id=?", [rows[0].id]);
    assert.strictEqual(b[0].payment_status, "paid");
    assert.strictEqual(Number(b[0].paid_amount), 20);
    assert.strictEqual(b[0].payment_method, "upi");
  });

  await step("controller: addMenuItem / getMenuItems (category_id)", async () => {
    const res = fakeRes();
    await ctrl.addMenuItem({ body: { name: "HAG6 Smoke Item", price: 5, category: "Others" }, file: null }, res);
    assert.strictEqual(res.code, undefined, JSON.stringify(res.body));
    const rows = await q("SELECT id, name FROM menu_items WHERE name='HAG6 Smoke Item'");
    assert(rows.length === 1);
    const getRes = fakeRes();
    await ctrl.getMenuItems({}, getRes);
    assert(getRes.body.length > 0);
  });

  await step("controller: updateMenuItem (table_number null-safe)", async () => {
    const rows = await q("SELECT id FROM menu_items WHERE name='HAG6 Smoke Item'");
    const res = fakeRes();
    await ctrl.updateMenuItem({ params: { id: rows[0].id }, body: { name: "HAG6 Smoke Item", price: 6, category_id: 1 }, file: null }, res);
    assert.strictEqual(res.code, undefined, JSON.stringify(res.body));
  });

  await step("controller: addTable + deleteTable guard on paid-only table", async () => {
    await cb((f) => m.addTable({ number: T3, seatCount: 2 }, f));
    const rows = await q("SELECT id FROM restaurant_tables WHERE number=?", [T3]);
    assert(rows[0].id > 0);
    // T3 has no bills: delete must succeed.
    await cb((f) => m.deleteTable(rows[0].id, f));
    const gone = await q("SELECT id FROM restaurant_tables WHERE number=?", [T3]);
    assert(gone.length === 0, "table with no bills should delete");
    // T1 has a paid bill: delete must 409.
    await cb((f) => m.addTable({ number: T1 }, f));
    const t1rows = await q("SELECT id FROM restaurant_tables WHERE number=?", [T1]);
    let probe = null;
    try {
      await cb((f) => m.deleteTable(t1rows[0].id, f));
    } catch (e) {
      probe = e;
    }
    assert(probe && probe.statusCode === 409, `expected 409 for table with a bill, got ${probe ? probe.statusCode + ":" + probe.message : "success"}`);
  });

  await step("model: createSplitBill", async () => {
    await cb((f) =>
      m.createSplitBill(
        { billId: 1, tableNumber: T1, splitLabel: "A", splitNo: 1, splitCount: 2, subtotal: 5, gst: 1, total: 6, paymentMethod: "cash" },
        f
      )
    );
  });

  await step("cleanup", async () => {
    await q("DELETE FROM restaurant_split_bills WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM bills WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM orders WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM tokens WHERE table_number IN (?)", [[T1, T3]]);
    await q("DELETE FROM restaurant_tables WHERE number IN (?)", [[T1, T3]]);
    await q("DELETE FROM menu_items WHERE name='HAG6 Smoke Item'");
  });

  if (failures) {
    console.error(`${failures} smoke step(s) failed`);
    process.exit(1);
  }
  console.log("SMOKE PASS");
  process.exit(0);
})().catch(async (err) => {
  console.error("SMOKE ABORT:", err.stack || err.message);
  process.exit(1);
});
