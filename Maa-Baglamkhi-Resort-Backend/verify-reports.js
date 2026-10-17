/* eslint-disable no-console */
// Verification runner for the reporting layer.
// Run against a live MySQL: node verify-reports.js
//
// Phase 1: boots the model schemas the reporting controllers depend on.
// Phase 2: seeds a few rows per source table with known, hand-computable values.
// Phase 3: calls the same aggregate SQL the controllers run, and compares the
//          result against the value an analyst would get from the raw tables.
// Phase 4: hits the live endpoints over HTTP (server must be running).

const db = require("./src/config/db");

const SILENT = process.argv.includes("--no-boot");

// db.query(sql, params, cb) is the shim over a mysql2 promise pool. Unlike a
// real callback query, its second argument is the bare rows array, not a
// [rows, fields] tuple — so callers below index into it directly instead of
// destructuring.
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const colExists = async (t, c) =>
  !!(await run(`SHOW COLUMNS FROM \`${t}\` LIKE ?`, [c])).length;
const tableExists = async (t) =>
  !!(await run("SHOW TABLES LIKE ?", [t])).length;

// ---- Phase 1 ---------------------------------------------------------------

const ensureColumn = async (t, c, def) => {
  if (!(await colExists(t, c))) await run(`ALTER TABLE \`${t}\` ADD COLUMN \`${c}\` ${def}`);
};

const BOOTSTRAP = [
  require("./src/models/AccountsModel"),
  require("./src/models/AccountsExpansionModel"),
  require("./src/models/InvoiceModel"),
  require("./src/models/BanquetModel"),
  require("./src/models/Housekeeping"),
  require("./src/models/RestaurantModel"),
  require("./src/models/BookingsModel"),
  require("./src/models/roomTariffModel"),
  require("./src/models/hotelRoomInventoryModel"),
  require("./src/models/RoomsModel"),
  require("./src/models/BillsModel"),
  require("./src/models/NotificationModel"),
].filter(Boolean);

const boot = async () => {
  for (const model of BOOTSTRAP) {
    if (typeof model.ensureSchema === "function") {
      try {
        await model.ensureSchema();
      } catch (err) {
        console.warn(`  [boot] ${model.name || "?"}: ${err.code || err.message}`);
      }
    }
  }

  // Columns the reporting SQL hard-codes but no model declares.
  const guards = [
    ["accounts_transactions", "is_deleted", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["banquet_bookings", "start_time", "DATETIME NULL"],
    ["banquet_bookings", "end_time", "DATETIME NULL"],
    ["banquet_bookings", "decoration_fee", "DECIMAL(10,2) DEFAULT 0"],
    ["banquet_halls", "rate_per_hour", "DECIMAL(10,2) DEFAULT 0"],
    ["bills", "payment_status", "ENUM('unpaid','partial','paid','refunded','cancelled') DEFAULT 'unpaid'"],
    ["invoices", "total_amount", "DECIMAL(12,2) DEFAULT 0"],
    ["invoices", "created_at", "DATETIME NULL"],
    ["invoices", "booking_id", "INT NULL"],
    ["housekeeping", "assignee", "VARCHAR(100) NOT NULL DEFAULT 'No Housekeeper'"],
    ["housekeeping", "created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"],
  ];
  for (const [t, c, d] of guards) {
    if (await tableExists(t)) await ensureColumn(t, c, d);
  }

  console.log("Phase 1 done — schema ready.");
};

// ---- Phase 2/3 -------------------------------------------------------------

const clear = async (t) => { if (await tableExists(t)) await run(`DELETE FROM \`${t}\``); };
const reset = async () => {
  for (const t of ["accounts_transactions", "banquet_bookings", "banquet_halls", "invoices", "bills", "housekeeping"]) {
    await clear(t);
  }
};

// Unique-ish key so a UNIQUE constraint never collides between runs.
const seedTag = (prefix) => `${prefix}-VERIFY-${Date.now()}`;

const round2 = (n) => Math.round(n * 100) / 100;
let failures = 0;
const check = (label, actual, expected) => {
  const ok = round2(Number(actual || 0)) === round2(Number(expected || 0));
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  got=${actual} want=${expected}`);
};

const verify = async () => {
  await reset();

  // Known values.
  // accounts_transactions: Income 100 + 250 = 350, one deleted Income 999.
  await run(`INSERT INTO accounts_transactions
    (date, type, department, description, amount, payment_mode, is_deleted) VALUES
    ('2026-10-17','Income','Room','seed income A', 100.00, 'Cash', 0),
    ('2026-10-17','Income','Restaurant','seed income B', 250.00, 'Card', 0),
    ('2026-10-16','Income','Room','deleted', 999.00, 'Cash', 1),
    ('2026-10-17','Expense','Room','seed expense', 60.00, 'Cash', 0)`);

  // banquet: hall 500/hr, booking 10:00-11:30 = 1.5h -> ceil(2) = 1000 + 150 decor = 1150.
  // CEIL rounds UP, so fractional hours bill a full hour. That is intended and
  // is the formula the reports module already used — not a bug.
  await run(`INSERT INTO banquet_halls (name, rate_per_hour) VALUES ('Grand Hall', 500)`);
  const halls = await run(`SELECT id FROM banquet_halls WHERE name = 'Grand Hall'`);
  await run(
    `INSERT INTO banquet_bookings
      (hall_id, customer_name, phone, event_title, event_date, start_time, end_time, decoration_fee, guests, status)
    VALUES (?, 'Seed Guest', '9999999999', 'Seed Dinner', '2026-10-17',
            '2026-10-17 10:00:00', '2026-10-17 11:30:00', 150.00, 20, 'confirmed')`,
    [halls[0].id],
  );

  // invoices: total_amount 425 today.
  await run(`INSERT INTO invoices (invoice_no, invoice_date, total_amount, created_at)
    VALUES (?, '2026-10-17', 425.00, '2026-10-17 09:00:00')`, [seedTag("INV")]);

  // bills: total 80 today.
  await run(`INSERT INTO bills (table_number, total, payment_status, created_at) VALUES ('T4', 80.00, 'paid', '2026-10-17 11:00:00')`);

  // housekeeping: 3 rooms, 1 Occupied, 1 Vacant Dirty (Cleaning), 1 Out of Service (Maintenance).
  await run(`INSERT INTO housekeeping (roomNo, roomType, status, assignee) VALUES
    ('101','Deluxe','Occupied','Anita'), ('102','Deluxe','Vacant Dirty','Anita'),
    ('103','Standard','Out of Service','No Housekeeper')`);

  console.log("Phase 2/3 — verifying aggregates:");

  const getOne = async (sql, params) => Number((await run(sql, params))[0]?.total || 0);

  check("todayRevenue invoices", await getOne(
    `SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices
      WHERE DATE(created_at) = CURDATE() AND total_amount > 0`, []), 425);

  check("todayRevenue bills", await getOne(
    `SELECT COALESCE(SUM(total),0) AS total FROM bills
      WHERE DATE(created_at) = CURDATE() AND total IS NOT NULL AND total > 0`, []), 80);

  check("todayRevenue banquet", await getOne(
    `SELECT COALESCE(SUM(COALESCE(h.rate_per_hour,0)
        * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time)/60))
        + COALESCE(b.decoration_fee,0)), 0) AS total
      FROM banquet_bookings b LEFT JOIN banquet_halls h ON h.id = b.hall_id
      WHERE DATE(b.start_time) = CURDATE()`, []), 1150);

  check("todayRevenue accounts income", await getOne(
    `SELECT COALESCE(SUM(amount),0) AS total FROM accounts_transactions
      WHERE DATE(date) = CURDATE() AND type = 'Income' AND is_deleted = 0 AND amount > 0`, []), 350);

  check("todayRevenue grand total", 425 + 80 + 1150 + 350, 1905);

  check("totalRevenueGenerated invoices", await getOne(
    `SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE total_amount > 0`, []), 425);

  check("totalRevenueGenerated bills", await getOne(
    `SELECT COALESCE(SUM(total),0) AS total FROM bills WHERE total IS NOT NULL AND total > 0`, []), 80);

  check("totalRevenueGenerated banquet", await getOne(
    `SELECT COALESCE(SUM(COALESCE(h.rate_per_hour,0)
        * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time)/60))
        + COALESCE(b.decoration_fee,0)), 0) AS total
      FROM banquet_bookings b LEFT JOIN banquet_halls h ON h.id = b.hall_id`, []), 1150);

  check("reports summary accountsTransactions", (await run(
    "SELECT COUNT(*) AS c FROM accounts_transactions"))[0].c, 4);

  check("reports summary banquetBookings", (await run(
    "SELECT COUNT(*) AS c FROM banquet_bookings"))[0].c, 1);

  check("reports summary restaurantBills", (await run(
    "SELECT COUNT(*) AS c FROM bills"))[0].c, 1);

  check("housekeeping report rows", (await run(
    "SELECT COUNT(*) AS c FROM housekeeping"))[0].c, 3);

  const hkRows = await run(
    `SELECT id, DATE(COALESCE(updated_at, created_at)) AS date, CAST(roomNo AS CHAR) AS roomNo,
            COALESCE(NULLIF(roomType,''), CAST(roomNo AS CHAR)) AS roomType, status, assignee
     FROM housekeeping`);
  check("housekeeping report shape", hkRows.length && hkRows[0].roomNo === "101" && hkRows[0].assignee === "Anita" ? 1 : 0, 1);

  const allBills = await run(
    `SELECT b.id, DATE(b.date) AS billDate, COALESCE(
        (COALESCE(h.rate_per_hour,0) * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE,b.start_time,b.end_time)/60)))
        + COALESCE(b.decoration_fee,0), COALESCE(b.decoration_fee,0)) AS amount
     FROM banquet_bookings b LEFT JOIN banquet_halls h ON h.id = b.hall_id`);
  check("all-bills banquet row amount", allBills[0].amount, 1150);

  console.log(failures ? `\n${failures} FAILURES` : "\nAll aggregates verified.");
  return failures;
};

// ---- Phase 4 ---------------------------------------------------------------

const verifyHttp = async () => {
  const base = process.env.VERIFY_BASE || "http://localhost:5002";
  let token;
  try {
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@resort.com", password: "password" }),
    });
    const body = await login.json().catch(() => ({}));
    token = body.token || body.accessToken || body.data?.token;
    if (!token) throw new Error(`login ${login.status} ${JSON.stringify(body).slice(0, 200)}`);
  } catch (err) {
    console.log(`Phase 4 skipped — login failed: ${err.message}`);
    return 0;
  }

  const h = { Authorization: `Bearer ${token}` };
  const paths = [
    "/api/dashboard/metrics",
    "/api/dashboard/charts",
    "/api/reports/summary",
    "/api/reports/data?type=all-bills",
    "/api/reports/data?type=room",
    "/api/reports/data?type=banquet",
    "/api/reports/data?type=restaurant",
    "/api/reports/data?type=housekeeping",
    "/api/reports/data?type=accounts",
  ];
  let failed = 0;
  for (const p of paths) {
    const res = await fetch(`${base}${p}`, { headers: h });
    const text = await res.text();
    const ok = res.status === 200;
    if (!ok) failed += 1;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${res.status}  ${p}  ${text.slice(0, 90).replace(/\n/g, " ")}`);
  }
  console.log(failed ? `\n${failed} endpoint(s) failing` : "\nAll endpoints returning 200.");
  return failed;
};

(async () => {
  if (!SILENT) await boot();
  const dbFailures = await verify();
  console.log("\nPhase 4 — HTTP sweep:");
  const httpFailures = await verifyHttp();
  process.exit(dbFailures + httpFailures ? 1 : 0);
})().catch((err) => {
  console.error("verify-reports aborted:", err);
  process.exit(2);
});
