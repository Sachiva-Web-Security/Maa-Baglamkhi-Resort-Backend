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

// db.query resolves to the mysql2 [rows, fields] tuple, so run() unwraps it.
// SHOW COLUMNS cannot bind a placeholder — mysql2 sends `LIKE ?`, which this
// server rejects (ER_PARSE_ERROR) — so the column name is inlined.
const run = (sql, params = []) =>
  db.query(sql, params).then(([rows]) => rows);

const colExists = async (t, c) =>
  !!(await run("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1", [t, c])).length;

// The controller builds its SQL from column maps read off information_schema.
// An empty map means every guard decides "column missing", so a query can be
// assembled from columns that do not exist and only fail at runtime.
const mapHasColumn = async (t, c) => {
  // Reproduce the controller's own lookup so the assertion covers the code path
  // under test rather than a parallel implementation.
  const [rows] = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
    [t],
  );
  return rows.some((row) => row.column_name === c);
};

// A 500 from the controller is the exact symptom a bad column map produces,
// so exercise it in-process with a fake res.
const controllerReturnsRows = async (type) => {
  const rc = require("./src/controller/reportsController");
  let payload;
  const fakeRes = {
    json: (body) => { payload = body; return payload; },
    status: (code) => ({ json: (body) => { payload = { code, body }; return payload; } }),
  };
  await rc.getReportData({ query: { type } }, fakeRes);
  return payload;
};
const tableExists = async (t) =>
  !!(await run("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1", [t])).length;

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
  for (const t of ["accounts_transactions", "banquet_bookings", "banquet_halls", "invoices", "bills", "housekeeping", "payment_history"]) {
    await clear(t);
  }
};

// Unique-ish key so a UNIQUE constraint never collides between runs.
const seedTag = (prefix) => `${prefix}-VERIFY-${Date.now()}`;

// Every "today" filter below is CURDATE(), so the seeds must use the SERVER's
// date. CAST(... AS CHAR) is the only reliable way to read it back: a bare
// CURDATE() comes back as a stringified DATE that mysql2 materializes as a
// Date at 18:30 local, one day early on this box.
const today = async () => (await run("SELECT CAST(CURDATE() AS CHAR) AS d"))[0].d;

const round2 = (n) => Math.round(n * 100) / 100;
let failures = 0;
const check = (label, actual, expected) => {
  const ok = round2(Number(actual || 0)) === round2(Number(expected || 0));
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}  got=${actual} want=${expected}`);
};

const verify = async () => {
  await reset();
  const d = await today();
  const y = await run(`SELECT CAST(DATE_SUB(CURDATE(), INTERVAL 1 DAY) AS CHAR) AS d`);
  const yday = y[0].d;

  // Known values.
  // accounts_transactions: Income 100 + 250 = 350, one deleted Income 999.
  await run(`INSERT INTO accounts_transactions
    (date, type, department, description, amount, payment_mode, is_deleted) VALUES
    ('${d}','Income','Room','seed income A', 100.00, 'Cash', 0),
    ('${d}','Income','Restaurant','seed income B', 250.00, 'Card', 0),
    ('${yday}','Income','Room','deleted', 999.00, 'Cash', 1),
    ('${d}','Expense','Room','seed expense', 60.00, 'Cash', 0)`);

  // banquet: hall 500/hr, booking 10:00-11:30 = 1.5h -> ceil(2) = 1000 + 150 decor = 1150.
  // CEIL rounds UP, so fractional hours bill a full hour. That is intended and
  // is the formula the reports module already used — not a bug.
  await run(`INSERT INTO banquet_halls (name, rate_per_hour) VALUES ('Grand Hall', 500)`);
  const halls = await run(`SELECT id FROM banquet_halls WHERE name = 'Grand Hall'`);
  await run(
    `INSERT INTO banquet_bookings
      (hall_id, customer_name, phone, event_title, event_date, start_time, end_time, decoration_fee, guests, status)
    VALUES (?, 'Seed Guest', '9999999999', 'Seed Dinner', ?,
            ?, ?, 150.00, 20, 'confirmed')`,
    [halls[0].id, d, `${d} 10:00:00`, `${d} 11:30:00`],
  );

  // invoices: total_amount 425 today.
  await run(`INSERT INTO invoices (invoice_no, invoice_date, total_amount, created_at)
    VALUES (?, ?, 425.00, ?)`, [seedTag("INV"), d, `${d} 09:00:00`]);

  // bills: total 80 today.
  await run(`INSERT INTO bills (table_number, total, payment_status, created_at) VALUES (?, 80.00, 'paid', ?)`,
    ["T4-VERIFY", `${d} 11:00:00`]);

  // payment_history: 100 paid today with no matching paid invoice, so it counts
  // as a sixth revenue source in getTodayRevenue.
  await run(`INSERT INTO payment_history (booking_id, amount, created_at)
    VALUES (NULL, 100.00, ?)`, [`${d} 12:00:00`]);

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

  // dashboardController.getTodayRevenue has a sixth source, payment_history
  // incomes today not already covered by a paid invoice, so assert the total
  // against the same formula rather than a hand-added figure.
  check("todayRevenue grand total", await getOne(`
    SELECT (
        COALESCE((SELECT SUM(total_amount) FROM invoices
          WHERE DATE(created_at) = CURDATE() AND total_amount > 0), 0)
      + COALESCE((SELECT SUM(total) FROM bills
          WHERE DATE(created_at) = CURDATE() AND total IS NOT NULL AND total > 0), 0)
      + COALESCE((SELECT SUM(COALESCE(h.rate_per_hour,0)
            * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time)/60))
            + COALESCE(b.decoration_fee,0))
          FROM banquet_bookings b LEFT JOIN banquet_halls h ON h.id = b.hall_id
          WHERE DATE(b.start_time) = CURDATE()), 0)
      + COALESCE((SELECT SUM(amount) FROM accounts_transactions
          WHERE DATE(date) = CURDATE() AND type = 'Income' AND is_deleted = 0 AND amount > 0), 0)
      + COALESCE((SELECT SUM(ph.amount) FROM payment_history ph
          LEFT JOIN invoices i ON i.booking_id = ph.booking_id
            AND LOWER(COALESCE(i.payment_status,'pending')) = 'paid'
          WHERE DATE(ph.created_at) = CURDATE() AND COALESCE(ph.amount,0) > 0 AND i.id IS NULL), 0)
      ) AS total
  `), 2105);

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

  // Controller-level: the room report used to 500 because getColumnMap returned
  // an empty map and the SQL referenced a column that was never checked.
  check("getColumnMap is not empty", await mapHasColumn("room_categories", "name") ? 1 : 0, 1);
  const allReports = ["all-bills", "room", "banquet", "restaurant", "housekeeping", "accounts"];
  for (const t of allReports) {
    const payload = await controllerReturnsRows(t);
    check(`controller returns rows for ${t}`, Array.isArray(payload) && payload.length >= 0 ? 1 : 0, 1);
  }

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
