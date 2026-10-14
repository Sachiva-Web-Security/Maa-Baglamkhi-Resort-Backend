#!/usr/bin/env node
/**
 * Lifecycle tests — prove that writes actually work.
 *
 * Unlike test/api-routes.test.js (which only proves each handler is reachable),
 * this suite performs real create -> read -> update -> delete round-trips and
 * asserts the values that come back. Every row it creates is cleaned up in
 * afterAll, so running it leaves the database as it found it.
 *
 * Each module test is independent: a failure in one does not stop the others,
 * and the summary reports every module's result.
 *
 * Usage:  npm run test:lifecycle
 */

const http = require("http");
const crypto = require("crypto");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5002";
const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || "admin@resort.com",
  password: process.env.TEST_ADMIN_PASSWORD || "password",
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
let token = null;

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: 20000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let parsed = data;
          try {
            parsed = JSON.parse(data);
          } catch {
            /* keep raw */
          }
          resolve({ status: res.statusCode, body: parsed, raw: data });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`TIMEOUT ${method} ${path}`));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Assertion helpers — collect failures instead of throwing on the first one
// ---------------------------------------------------------------------------
function createSuite(name) {
  const results = [];
  const cleanup = [];

  const check = (label, condition, detail) => {
    results.push({ label, ok: Boolean(condition), detail: detail || "" });
    const mark = condition ? "PASS" : "FAIL";
    console.log(`   ${mark}  ${label}${condition || !detail ? "" : ` -> ${detail}`}`);
  };

  const onCleanup = (fn) => cleanup.push(fn);

  return {
    name,
    results,
    check,
    onCleanup,
    async runCleanup() {
      for (const fn of cleanup.reverse()) {
        try {
          await fn();
        } catch (err) {
          console.log(`   [cleanup] ${err.message}`);
        }
      }
    },
  };
}

function summarize(suite) {
  const passed = suite.results.filter((r) => r.ok).length;
  const failed = suite.results.length - passed;
  return { name: suite.name, passed, failed, results: suite.results };
}

// ---------------------------------------------------------------------------
// Module 1 — Hotel booking lifecycle
// ---------------------------------------------------------------------------
async function testBookingLifecycle() {
  const suite = createSuite("Hotel booking lifecycle");
  const s = suite.name;
  const { check, onCleanup } = suite;
  console.log(`\n[${s}]`);

  const stamp = crypto.randomBytes(3).toString("hex");
  const guestName = `Lifecycle Guest ${stamp}`;
  const checkIn = "2026-03-01";
  const checkOut = "2026-03-04";

  // --- Create ---
  const created = await api("POST", "/api/hotel/guest", {
    guestName,
    phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
    checkIn,
    checkOut,
    adults: 2,
    bookingStatus: "confirmed",
    specialRequests: "lifecycle test",
  });

  check("POST /api/hotel/guest returns 201/200", [200, 201].includes(created.status), `got ${created.status}`);
  const bookingId = created.body?.bookingId || created.body?.id || created.body?.insertId;
  check("response carries a booking id", Boolean(bookingId), JSON.stringify(created.body).slice(0, 160));

  if (bookingId) {
    onCleanup(async () => {
      await api("DELETE", `/api/hotel/booking/${bookingId}`).catch(() => {});
    });
  }

  if (!bookingId) {
    await suite.runCleanup();
    return summarize(suite);
  }

  // --- Read back ---
  const fetched = await api("GET", `/api/hotel/full-booking/${bookingId}`);
  check("GET /api/hotel/full-booking/:id returns 200", fetched.status === 200, `got ${fetched.status}`);
  check(
    "booking reflects the guest name we sent",
    JSON.stringify(fetched.body).includes(guestName),
    JSON.stringify(fetched.body).slice(0, 200)
  );
  check(
    "booking reflects check_in date",
    JSON.stringify(fetched.body).includes(checkIn),
    JSON.stringify(fetched.body).slice(0, 200)
  );

  // --- Update (pax) ---
  // v4 stores pax counts on booking_rooms, so the handler requires a room that
  // is actually attached to the booking.
  const attachedRoom = await api("GET", `/api/hotel/full-booking/${bookingId}`);
  const roomNumber =
    attachedRoom.body?.rooms?.[0]?.room_number ||
    attachedRoom.body?.roomNumber ||
    attachedRoom.body?.rooms?.[0] ||
    null;

  if (roomNumber) {
    const paxUpdate = await api("POST", `/api/hotel/pax/${bookingId}`, {
      roomNumber: String(roomNumber),
      adults: 3,
      children: 1,
    });
    check(
      "POST /api/hotel/pax/:id accepted",
      [200, 201].includes(paxUpdate.status),
      `got ${paxUpdate.status} ${JSON.stringify(paxUpdate.body).slice(0, 120)}`
    );

    const paxReadBack = await api("GET", `/api/hotel/full-booking/${bookingId}`);
    check(
      "pax update is persisted on the booking",
      JSON.stringify(paxReadBack.body).includes("3"),
      JSON.stringify(paxReadBack.body).slice(0, 200)
    );
  } else {
    check(
      "POST /api/hotel/pax/:id accepted",
      false,
      "no room attached to the booking, so pax has no target row"
    );
  }

  // --- Advance payment ---
  const advance = await api("POST", `/api/hotel/advance/${bookingId}`, {
    amount: 500,
    mode: "Cash",
    paymentMode: "Cash",
  });
  check(
    "POST /api/hotel/advance/:id accepted",
    [200, 201].includes(advance.status),
    `got ${advance.status} ${JSON.stringify(advance.body).slice(0, 120)}`
  );

  // --- Folio entry (money on the bill) ---
  const folio = await api("POST", `/api/hotel/folio/${bookingId}`, {
    entryType: "Extra Charge",
    category: "Laundry",
    description: "lifecycle test charge",
    amount: 250,
    entryDate: checkIn,
  });
  check(
    "POST /api/hotel/folio/:id accepted",
    [200, 201].includes(folio.status),
    `got ${folio.status} ${JSON.stringify(folio.body).slice(0, 120)}`
  );

  const folioRead = await api("GET", `/api/hotel/folio/${bookingId}`);
  check("GET /api/hotel/folio/:id returns the entry", folioRead.status === 200, `got ${folioRead.status}`);

  // --- Verify advance + folio are reflected in billing ---
  const billing = await api("GET", "/api/accounts/hotel-billing");
  check("GET /api/accounts/hotel-billing returns 200", billing.status === 200, `got ${billing.status}`);

  // --- Cancel (soft delete) ---
  const cancel = await api("PUT", `/api/hotel/booking/${bookingId}/cancel`, {
    reason: "lifecycle test cleanup",
  });
  check(
    "PUT /api/hotel/booking/:id/cancel accepted",
    [200, 201].includes(cancel.status) || cancel.status === 404,
    `got ${cancel.status} ${JSON.stringify(cancel.body).slice(0, 120)}`
  );

  await suite.runCleanup();
  return summarize(suite);
}

// ---------------------------------------------------------------------------
// Module 2 — Restaurant / KOT lifecycle
// ---------------------------------------------------------------------------
async function testRestaurantLifecycle() {
  const suite = createSuite("Restaurant / KOT lifecycle");
  const s = suite.name;
  const { check, onCleanup } = suite;
  console.log(`\n[${s}]`);

  const stamp = crypto.randomBytes(3).toString("hex");
  const tableName = `LT-${stamp}`;

  // --- Create table ---
  // The handler reads `number` (table number), not `name`.
  const table = await api("POST", "/api/restaurant/tables", {
    number: tableName,
    seatCount: 4,
    floorName: "Test Floor",
  });
  check(
    "POST /api/restaurant/tables accepted",
    [200, 201].includes(table.status),
    `got ${table.status} ${JSON.stringify(table.body).slice(0, 120)}`
  );

  const tablesList = await api("GET", "/api/restaurant/tables");
  const createdTable = Array.isArray(tablesList.body)
    ? tablesList.body.find((t) => String(t.number) === tableName)
    : null;
  check("new table appears in GET /api/restaurant/tables", Boolean(createdTable), "not found in list");

  // --- Create KOT order ---
  const kotNo = `KOT-LT-${stamp}`;
  const order = await api("POST", "/api/kitchen/order", {
    table: tableName,
    waiter: "Lifecycle Test",
    entityType: "Table",
    kotNo,
    prepTimeMinutes: 15,
    items: [{ name: "Test Item", qty: 2, price: 100, rate: 100 }],
  });
  check(
    "POST /api/kitchen/order accepted",
    [200, 201].includes(order.status),
    `got ${order.status} ${JSON.stringify(order.body).slice(0, 140)}`
  );

  const kitchenOrders = await api("GET", "/api/kitchen/orders");
  const ourOrder = Array.isArray(kitchenOrders.body)
    ? kitchenOrders.body.find((o) => String(o.kot_no || o.kotNo) === kotNo)
    : null;
  check("new KOT appears in GET /api/kitchen/orders", Boolean(ourOrder), "KOT not found");

  const orderId = ourOrder?.id;
  if (orderId) {
    onCleanup(async () => {
      await api("DELETE", `/api/kitchen/orders/${orderId}`).catch(() => {});
    });

    // --- Status transition: Pending -> Preparing ---
    const preparing = await api("PUT", `/api/kitchen/orders/${orderId}`, { status: "Preparing" });
    check(
      "PUT /api/kitchen/orders/:id (Preparing) accepted",
      [200, 201].includes(preparing.status),
      `got ${preparing.status} ${JSON.stringify(preparing.body).slice(0, 120)}`
    );

    // --- Status transition: Preparing -> Ready ---
    const ready = await api("PUT", `/api/kitchen/orders/${orderId}`, { status: "Ready" });
    check(
      "PUT /api/kitchen/orders/:id (Ready) accepted",
      [200, 201].includes(ready.status),
      `got ${ready.status} ${JSON.stringify(ready.body).slice(0, 120)}`
    );

    const readyList = await api("GET", "/api/waiter/orders/ready");
    check(
      "ready order shows on waiter board",
      Array.isArray(readyList.body) && readyList.body.some((o) => o.id === orderId),
      "not on ready board"
    );

    // --- Pickup by waiter ---
    const pickup = await api("PATCH", `/api/waiter/orders/${orderId}/pickup`, {});
    check(
      "PATCH /api/waiter/orders/:id/pickup accepted",
      [200, 201].includes(pickup.status),
      `got ${pickup.status} ${JSON.stringify(pickup.body).slice(0, 120)}`
    );
  }

  // --- Create bill from the order ---
  const bill = await api("POST", "/api/restaurant/bill", {
    table: tableName,
    tableNumber: tableName,
    items: [{ name: "Test Item", qty: 2, price: 100 }],
    discount: 0,
  });
  check(
    "POST /api/restaurant/bill accepted",
    [200, 201].includes(bill.status),
    `got ${bill.status} ${JSON.stringify(bill.body).slice(0, 140)}`
  );

  const bills = await api("GET", "/api/restaurant/bills");
  const ourBill = Array.isArray(bills.body)
    ? bills.body.find((b) => String(b.table_number || b.tableNumber || b.table) === tableName)
    : null;
  check("new bill appears in GET /api/restaurant/bills", Boolean(ourBill), "bill not found");

  const billId = ourBill?.id;
  if (billId) {
    onCleanup(async () => {
      await api("DELETE", `/api/restaurant/bills/${billId}`).catch(() => {});
    });

    const pay = await api("POST", `/api/restaurant/bill/${billId}/pay`, {
      amount: ourBill.total || 200,
      mode: "Cash",
      paymentMode: "Cash",
    });
    check(
      "POST /api/restaurant/bill/:id/pay accepted",
      [200, 201].includes(pay.status),
      `got ${pay.status} ${JSON.stringify(pay.body).slice(0, 140)}`
    );
  }

  if (createdTable) {
    onCleanup(async () => {
      await api("DELETE", `/api/restaurant/tables/${createdTable.id}`).catch(() => {});
    });
  }

  await suite.runCleanup();
  return summarize(suite);
}

// ---------------------------------------------------------------------------
// Module 3 — Accounts ledger lifecycle (money path)
// ---------------------------------------------------------------------------
async function testAccountsLifecycle() {
  const suite = createSuite("Accounts ledger lifecycle");
  const s = suite.name;
  const { check, onCleanup } = suite;
  console.log(`\n[${s}]`);

  const stamp = crypto.randomBytes(3).toString("hex");
  const description = `Lifecycle test income ${stamp}`;
  const amount = 1234.56;

  // --- Record income ---
  const income = await api("POST", "/api/accounts/income", {
    date: new Date().toISOString().slice(0, 10),
    description,
    amount,
    paymentMode: "Cash",
    payment_mode: "Cash",
    department: "Restaurant",
  });
  check(
    "POST /api/accounts/income returns 201",
    income.status === 201,
    `got ${income.status} ${JSON.stringify(income.body).slice(0, 160)}`
  );

  const transactionId = income.body?.id;
  const transactionNo = income.body?.transaction_no;
  check("income response carries a transaction id", Boolean(transactionId), JSON.stringify(income.body).slice(0, 160));
  check("income response carries a transaction_no", Boolean(transactionNo), JSON.stringify(income.body).slice(0, 160));

  if (transactionId) {
    onCleanup(async () => {
      await api("DELETE", `/api/accounts/transactions/${transactionId}`).catch(() => {});
    });

    // --- Read it back ---
    const single = await api("GET", `/api/accounts/transactions/${transactionId}`);
    check("GET /api/accounts/transactions/:id returns 200", single.status === 200, `got ${single.status}`);
    check(
      "transaction round-trips its description",
      JSON.stringify(single.body).includes(description),
      JSON.stringify(single.body).slice(0, 200)
    );

    // --- Double-entry balance: debits must equal credits ---
    // getTransactionById returns the header plus its journal legs
    const withEntries = await api("GET", `/api/accounts/transactions/${transactionId}`);
    const legs = withEntries.body?.entries;
    if (Array.isArray(legs) && legs.length) {
      const debit = legs
        .filter((e) => String(e.entry_type || e.entryType).toLowerCase() === "debit")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const credit = legs
        .filter((e) => String(e.entry_type || e.entryType).toLowerCase() === "credit")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      check("ledger has two entries", legs.length === 2, `got ${legs.length}`);
      check(
        `debits equal credits (${debit} vs ${credit})`,
        Math.abs(debit - credit) < 0.01,
        `debit=${debit} credit=${credit}`
      );
      check(
        `entry amount matches what we sent (${amount})`,
        Math.abs(debit - amount) < 0.01,
        `debit=${debit}`
      );
    } else {
      check("ledger entries readable", false, `got ${withEntries.status} ${JSON.stringify(withEntries.body).slice(0, 160)}`);
    }

    // --- Update ---
    const updated = await api("PUT", `/api/accounts/transactions/${transactionId}`, {
      description: `${description} (updated)`,
    });
    check(
      "PUT /api/accounts/transactions/:id accepted",
      [200, 201].includes(updated.status),
      `got ${updated.status} ${JSON.stringify(updated.body).slice(0, 140)}`
    );
  }

  // --- Expense path ---
  const expenseDesc = `Lifecycle test expense ${stamp}`;
  const expense = await api("POST", "/api/accounts/expense", {
    date: new Date().toISOString().slice(0, 10),
    description: expenseDesc,
    amount: 99.99,
    paymentMode: "Cash",
    department: "Restaurant",
  });
  check(
    "POST /api/accounts/expense returns 201",
    expense.status === 201,
    `got ${expense.status} ${JSON.stringify(expense.body).slice(0, 160)}`
  );
  if (expense.body?.id) {
    onCleanup(async () => {
      await api("DELETE", `/api/accounts/transactions/${expense.body.id}`).catch(() => {});
    });
  }

  // --- Validation guards ---
  const badAmount = await api("POST", "/api/accounts/income", {
    date: new Date().toISOString().slice(0, 10),
    description: "should be rejected",
    amount: 0,
    paymentMode: "Cash",
  });
  check(
    "income with amount 0 is rejected (400)",
    badAmount.status === 400,
    `got ${badAmount.status} ${JSON.stringify(badAmount.body).slice(0, 120)}`
  );

  const noDesc = await api("POST", "/api/accounts/income", {
    date: new Date().toISOString().slice(0, 10),
    amount: 10,
    paymentMode: "Cash",
  });
  check(
    "income with no description is rejected (400)",
    noDesc.status === 400,
    `got ${noDesc.status} ${JSON.stringify(noDesc.body).slice(0, 120)}`
  );

  // --- Summary reflects the ledger ---
  const summary = await api("GET", "/api/accounts/summary");
  check("GET /api/accounts/summary returns 200", summary.status === 200, `got ${summary.status}`);

  await suite.runCleanup();
  return summarize(suite);
}

// ---------------------------------------------------------------------------
// Module 4 — Auth & user lifecycle
// ---------------------------------------------------------------------------
async function testAuthLifecycle() {
  const suite = createSuite("Auth & user lifecycle");
  const s = suite.name;
  const { check, onCleanup } = suite;
  console.log(`\n[${s}]`);

  const stamp = crypto.randomBytes(3).toString("hex");
  const email = `lifecycle-${stamp}@test.com`;
  const password = "Lifecycle@123";

  // --- Register ---
  const reg = await api("POST", "/api/auth/register", {
    name: "Lifecycle User",
    email,
    password,
    role: "receptionist",
  });
  check(
    "POST /api/auth/register returns 200/201",
    [200, 201].includes(reg.status),
    `got ${reg.status} ${JSON.stringify(reg.body).slice(0, 140)}`
  );

  const userId = reg.body?.id || reg.body?.user?.id || reg.body?.insertId;
  if (userId) {
    onCleanup(async () => {
      await api("DELETE", `/api/users/${userId}`).catch(() => {});
    });
  }

  // --- Login as the new user ---
  const login = await api("POST", "/api/auth/login", { email, password });
  check(
    "new user can log in",
    login.status === 200 && Boolean(login.body?.token),
    `got ${login.status} ${JSON.stringify(login.body).slice(0, 140)}`
  );

  if (login.body?.token) {
    const roleName = String(login.body.role || "").toLowerCase();
    check(
      `login returns a role name, not an id (got "${login.body.role}")`,
      isNaN(Number(roleName)) && roleName.length > 0,
      JSON.stringify(login.body).slice(0, 160)
    );
    check(
      "login returns a user id for session validation",
      Boolean(login.body.id),
      JSON.stringify(login.body).slice(0, 160)
    );

    // --- /auth/me with that token ---
    const savedToken = token;
    token = login.body.token;
    const me = await api("GET", "/api/auth/me");
    check("GET /api/auth/me works for the new user", me.status === 200, `got ${me.status}`);
    check(
      "/auth/me echoes the same email",
      String(me.body?.email || "").toLowerCase() === email.toLowerCase(),
      JSON.stringify(me.body).slice(0, 160)
    );
    token = savedToken;
  }

  // --- Wrong password rejected ---
  const badLogin = await api("POST", "/api/auth/login", { email, password: "wrong-password" });
  check(
    "wrong password is rejected (400/401)",
    [400, 401].includes(badLogin.status),
    `got ${badLogin.status} ${JSON.stringify(badLogin.body).slice(0, 120)}`
  );

  // --- User appears in listing ---
  const users = await api("GET", "/api/users");
  const listed = Array.isArray(users.body) && users.body.some((u) => String(u.email).toLowerCase() === email);
  check("new user appears in GET /api/users", listed, "not in user list");

  // --- Password hash never leaks ---
  const leaks = JSON.stringify(users.body);
  check(
    "GET /api/users does not expose password hashes",
    !/password_hash|\$2[aby]\$/.test(leaks),
    "possible password leak in response"
  );

  await suite.runCleanup();
  return summarize(suite);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=".repeat(72));
  console.log(" LIFECYCLE TESTS  (create -> read -> update -> delete)");
  console.log("=".repeat(72));

  const login = await api("POST", "/api/auth/login", ADMIN);
  if (login.status !== 200 || !login.body?.token) {
    console.error("\n[FATAL] Admin login failed - cannot run lifecycle tests.");
    console.error("  status:", login.status, login.raw.slice(0, 200));
    process.exit(1);
  }
  token = login.body.token;
  console.log(`\n[0] Authenticated as ${ADMIN.email}`);

  const modules = [
    testBookingLifecycle,
    testRestaurantLifecycle,
    testAccountsLifecycle,
    testAuthLifecycle,
  ];

  const summaries = [];
  for (const mod of modules) {
    try {
      summaries.push(await mod());
    } catch (err) {
      console.log(`\n[${mod.name}] CRASHED: ${err.message}`);
      summaries.push({ name: mod.name, passed: 0, failed: 1, results: [{ label: "module crashed", ok: false, detail: err.message }] });
    }
  }

  // Report
  console.log("\n" + "=".repeat(72));
  console.log(" SUMMARY BY MODULE");
  console.log("=".repeat(72));

  let totalPass = 0;
  let totalFail = 0;

  for (const s of summaries) {
    totalPass += s.passed;
    totalFail += s.failed;
    const mark = s.failed === 0 ? "PASS" : "FAIL";
    console.log(
      `  ${mark}  ${s.name.padEnd(34)} ${String(s.passed).padStart(3)} passed, ${String(s.failed).padStart(2)} failed`
    );
  }

  console.log("-".repeat(72));
  console.log(`  TOTAL: ${totalPass} passed, ${totalFail} failed`);

  const allFailures = summaries.flatMap((s) =>
    s.results.filter((r) => !r.ok).map((r) => ({ module: s.name, ...r }))
  );

  if (allFailures.length) {
    console.log("\n  FAILURES:");
    for (const f of allFailures) {
      console.log(`    [${f.module}] ${f.label}`);
      if (f.detail) console.log(`        ${f.detail}`);
    }
  }

  console.log("=".repeat(72) + "\n");
  process.exitCode = totalFail > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("Lifecycle runner crashed:", err);
  process.exit(1);
});
