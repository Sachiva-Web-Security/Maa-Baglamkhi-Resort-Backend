const http = require("http");
const fs = require("fs");

const BASE = "http://127.0.0.1:5002";
const TAG = "HAG6E2E-" + Date.now();

let token = null;
let failures = 0;

function req(method, path, body, auth) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      {
        host: "127.0.0.1",
        port: 5002,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...(auth !== false ? (token ? { Authorization: "Bearer " + token } : {}) : {}),
        },
      },
      (s) => {
        let x = "";
        s.on("data", (c) => (x += c));
        s.on("end", () => {
          let j = x;
          try { j = JSON.parse(x); } catch (e) {}
          resolve({ status: s.statusCode, body: j, raw: x });
        });
      }
    );
    if (data) r.write(data);
    r.end();
  });
}

function step(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? "OK  " : "FAIL"), name, detail ? `| ${JSON.stringify(detail).slice(0, 220)}` : "");
  fs.appendFileSync("/tmp/e2e-hag6.log", `${new Date().toISOString()} ${ok ? "OK  " : "FAIL"} ${name} ${detail ? JSON.stringify(detail).slice(0, 300) : ""}\n`);
}

(async () => {
  fs.writeFileSync("/tmp/e2e-hag6.log", `E2E run ${TAG}\n`);

  // 0. login
  const login = await req("POST", "/api/auth/login", { email: "admin@resort.com", password: "password" }, false);
  token = login.body.token;
  step("login admin", login.status === 200 && !!token, login.body.message);

  // 1. menu browse
  const menu = await req("GET", "/api/restaurant/menu");
  step("menu browse", menu.status === 200 && Array.isArray(menu.body), { status: menu.status, count: Array.isArray(menu.body) ? menu.body.length : "n/a" });
  let menuItem = Array.isArray(menu.body) && menu.body.length ? menu.body[0] : null;
  if (!menuItem) {
    const add = await req("POST", "/api/restaurant/menu", { name: TAG + " Paneer", price: 260, category: "Main", category_id: null, tax: 5, available: true });
    step("menu add (none present)", add.status === 200 || add.status === 201, add.body);
    const menu2 = await req("GET", "/api/restaurant/menu");
    menuItem = (menu2.body || []).find((m) => String(m.name).includes(TAG));
    step("menu item visible", !!menuItem, menuItem && { id: menuItem.id, name: menuItem.name, price: menuItem.price });
  }

  // 2. table assignment
  const TABLE = TAG.slice(0, 14);
  const tableRes = await req("POST", "/api/restaurant/tables", { number: TABLE, seatCount: 4, sectionName: "HAG6" });
  step("table assign", (tableRes.status === 200 && tableRes.body.id) || (tableRes.status === 400 && tableRes.body.message === "Table already exists"), tableRes.body);
  if (tableRes.status === 200) {
    const lookup = await req("GET", "/api/restaurant/tables");
    const found = (lookup.body || []).find((t) => String(t.number || t.table_number || t.table) === TABLE);
    step("table visible", !!found, found && { id: found.id, number: found.number });
  } else if (tableRes.status === 400) {
    const lookup = await req("GET", "/api/restaurant/tables");
    const found = (lookup.body || []).find((t) => String(t.number || t.table_number || t.table) === TABLE);
    step("table exists (reused)", !!found, found && { id: found.id, number: found.number });
  }
  let myTable = null;
  {
    const lookup = await req("GET", "/api/restaurant/tables");
    myTable = (lookup.body || []).find((t) => String(t.number || t.table_number || t.table) === TABLE);
  }

  // 3. order placement (UI shape: { tableNumber, item })
  const orderRes = await req("POST", "/api/restaurant/order/add", {
    tableNumber: TABLE,
    item: { name: menuItem.name, quantity: 2, price: menuItem.price, tax: menuItem.tax ?? 0, menuItemId: menuItem.id },
  });
  step("order add", orderRes.status === 200 && orderRes.body.orderId, orderRes.body);
  const orderId = orderRes.body.orderId;

  // 4. kitchen KOT
  const kotRes = await req("POST", "/api/kitchen/order", {
    table: TABLE,
    waiter: "Karan",
    items: [{ name: menuItem.name, quantity: 2 }],
    prepTimeMinutes: 15,
    entityType: "Table",
  });
  const kotId = kotRes.body.order?.id || kotRes.body.id;
  step("KOT create", kotRes.status === 200 && !!kotId, kotRes.body);

  // 5. order status flow
  const kotNow = await req("PUT", `/api/kitchen/orders/${kotId}`, { status: "preparing" });
  step("KOT -> preparing", kotNow.status === 200, kotNow.body);
  const kotDone = await req("PUT", `/api/kitchen/orders/${kotId}`, { status: "completed" });
  step("KOT -> completed", kotDone.status === 200, kotDone.body);

  // 6. billing
  const billRes = await req("POST", "/api/restaurant/bill", {
    tableNumber: TABLE,
    items: [{ name: menuItem.name, quantity: 2, price: menuItem.price }],
    subtotal: 520,
    total: 546,
  });
  step("create bill", billRes.status === 200, billRes.body);
  const billId = billRes.body.billId || billRes.body.id || billRes.body.bill?.id;
  if (billRes.status === 200 && billId) {
    const payRes = await req("POST", `/api/restaurant/bill/${billId}/pay`, { paymentMethod: "cash" });
    step("pay bill", payRes.status === 200, payRes.body);
  } else {
    // fall back: pay the running order's bill if one was created
    const bills = await req("GET", "/api/restaurant/bills");
    const openBill = (bills.body || []).find((b) => String(b.table_number || b.tableNumber).includes(TAG) && b.status !== "paid");
    step("bills list fallback", bills.status === 200, { count: Array.isArray(bills.body) ? bills.body.length : "n/a" });
    if (openBill) {
      const payRes = await req("POST", `/api/restaurant/bill/${openBill.id}/pay`, { paymentMethod: "cash" });
      step("pay open bill", payRes.status === 200, payRes.body);
    } else {
      const payOrder = await req("PUT", `/api/restaurant/order/${TABLE}/pay`, { paymentMethod: "cash" });
      step("pay order (fallback)", payOrder.status === 200, payOrder.body);
    }
  }

  // 7. room service: add room, menu item, order
  const ROOM = "RS-" + TAG.slice(0, 8);
  const roomAdd = await req("POST", "/api/room-service/rooms", { number: ROOM });
  step("room add", roomAdd.status === 200 || (roomAdd.status === 400 && roomAdd.body.message === "Room already exists"), roomAdd.body);

  const rsMenu = await req("GET", "/api/room-service/menu");
  let rsItem = (rsMenu.body || []).find((m) => String(m.name).includes(TAG));
  if (!rsItem) {
    const addRs = await req("POST", "/api/room-service/menu", { name: TAG + " Soup", price: 150, category: "Soup", category_id: null, tax: 5, available: true });
    step("room menu add", addRs.status === 200, addRs.body);
    const rsMenu2 = await req("GET", "/api/room-service/menu");
    rsItem = (rsMenu2.body || []).find((m) => String(m.name).includes(TAG));
  }

  // UI shape: { roomNumber, items }
  const rsOrder = await req("POST", "/api/room-service/order/add", {
    roomNumber: ROOM,
    items: [{ name: rsItem.name, quantity: 1, price: rsItem.price, menuItemId: rsItem.id }],
  });
  step("room-service order", rsOrder.status === 200, rsOrder.body);

  // 8. waiter queue -> delivery
  const assign = await req("POST", "/api/room-service-delivery/assign-waiter", { roomNumber: ROOM, waiterName: "Karan" });
  step("assign waiter", assign.status === 200, assign.body);
  const queue = await req("GET", `/api/room-service-delivery/waiter-queue?waiterName=Karan`);
  const inQueue = (queue.body || []).find((o) => String(o.room_number || o.roomNumber) === ROOM || String(o.room_number || o.roomNumber).includes(TAG));
  step("waiter queue shows order", queue.status === 200 && !!inQueue, { status: queue.status, rows: (queue.body || []).length });

  if (inQueue) {
    const delivered = await req("POST", `/api/room-service-delivery/mark-delivered/${inQueue.id}`);
    step("mark delivered", delivered.status === 200, delivered.body);
  }

  // 9. cleanup: tear down the entities I created (only when I made them this run)
  if (myTable?.id || myTable?.table_id) {
    const del = await req("DELETE", `/api/restaurant/tables/${myTable.id ?? myTable.table_id}`);
    step(tableRes.status === 200 ? "cleanup table" : "cleanup table (pre-existing, paid-gated)",
      tableRes.status === 200 ? del.status === 200 : [200, 204, 404, 409].includes(del.status),
      del.body && del.body.message);
  }
  const delRoom = await req("PUT", `/api/room-service/order/${ROOM}/pay`, { paymentMethod: "cash" });
  step("room order settled/cleanup", [200, 400, 409].includes(delRoom.status), delRoom.body && delRoom.body.message);

  console.log(failures === 0 ? "\nE2E PASS (all steps)" : `\nE2E FAILURES: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("E2E crash:", e);
  process.exit(2);
});
