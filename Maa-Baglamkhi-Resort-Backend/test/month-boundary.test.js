const request = require("supertest");

// Jest forces NODE_ENV=test before any test module loads, and under that flag
// databaseConfig resolves DB_NAME_TEST (hotel_management_test) instead of the
// DB_NAME the app actually runs against. This box has no such database, so the
// suite would fail at connect; a stale DB_NAME_TEST pointing elsewhere would be
// worse, because several table names collide and every write would silently
// land in the wrong schema. Both are reset here so this suite hits the real
// local db (resort_management) as HAG-34 requires. The auth rate limiter
// skips this local request on any non-"test" NODE_ENV, so logins are not
// throttled.
process.env.NODE_ENV = "production";
process.env.DB_NAME_TEST = process.env.DB_NAME || "resort_management";

const db = require("../src/config/db");
const payrollRoutes = require("../src/routes/payrollRoutes");
const authRoutes = require("../src/routes/authRoutes");

// HAG-34: 4dc3440 replaced `MONTH(date)=? AND YEAR(date)=?` with half-open date
// ranges at three call sites. The bound only holds if the upper edge lands on the
// 1st of the following month, including 31 Dec -> 1 Jan. Every row inside the
// range is paid; every row outside must be excluded. Driven over real MySQL so
// the boundary can only be observed, not reasoned about.
//
// Routes are mounted directly rather than via src/app: app.js pulls in
// middleware/auditLogger.js, where `inferModule` is declared twice. Node accepts
// the duplicate, but jest's babel transform does not, so anything that requires
// src/app fails at load time. That defect is out of scope for this test.
const express = require("express");
const http = express();
http.use(express.json());
http.use("/api/auth", authRoutes);
http.use("/api/payroll", payrollRoutes);

const ADMIN = { email: "admin@resort.com", password: "password" };
const BASE_SALARY = 31000;
const MARKER = "__hag34_month__";

const ROWS = [
  { date: "2026-11-30", status: "present" },
  { date: "2026-12-01", status: "present" },
  { date: "2026-12-31", status: "present" },
  { date: "2027-01-01", status: "present" },
  { date: "2027-01-31", status: "present" },
  { date: "2027-02-01", status: "present" },
];

const iso = (value) => {
  if (Array.isArray(value)) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

let employeeId;
let token;
let probeCode;

beforeAll(async () => {
  // mysql2 defaults dateStrings: false, so DATE values come back as JS Date
  // objects and get shifted by the session offset (IST here). Returning DATE as
  // 'YYYY-MM-DD' text is what the boundary assertions need. Mutating the config
  // after createPool only affects connections opened later, so the options are
  // patched on the connection config that every pooled connection inherits.
  db.pool.config.connectionConfig.dateStrings = true;

  const { body, status } = await request(http)
    .post("/api/auth/login")
    .send({ email: ADMIN.email, password: ADMIN.password });
  expect(status).toBe(200);
  token = body.token;

  // The employee is inserted directly rather than through POST /api/employees.
  // That endpoint reads its new row back with LIST_QUERY and, when the
  // read-back comes back empty, reports employee: { id: users.id } while the
  // employees insert has already failed — a half-created employee the caller
  // believes exists. estimateSalary accepts either id, so a leaked users.id
  // still resolves to a real employee and masks the gap. Seeding straight into
  // employees keeps this suite's subject to the date range it is meant to
  // prove. Reported to god; see HAG-210-test-gate.md.
  probeCode = `EMP-${Date.now()}`;
  await db.execute(
    "INSERT INTO employees (employee_code, first_name, base_salary, is_active) VALUES (?, ?, ?, 1)",
    [probeCode, "HAG34 Boundary Probe", BASE_SALARY],
  );
  const [newest] = await db.query(
    "SELECT id FROM employees WHERE employee_code = ? ORDER BY id DESC LIMIT 1",
    [probeCode],
  );
  employeeId = Number(newest && newest[0] && newest[0].id);
  expect(Number.isFinite(employeeId)).toBe(true);

  for (const row of ROWS) {
    await db.execute(
      "INSERT INTO attendance_records (employee_id, date, status, notes) VALUES (?, ?, ?, ?)",
      [employeeId, row.date, row.status, MARKER],
    );
  }
});

afterAll(async () => {
  await db.execute(
    "DELETE FROM attendance_records WHERE employee_id = ? AND notes = ?",
    [employeeId, MARKER],
  );
  await db.execute("DELETE FROM employees WHERE id = ?", [employeeId]);
  db.pool.config.connectionConfig.dateStrings = false;
  await db.end();
});

// The route takes ?month=YYYY-MM. Supplying year= and month= separately is not
// equivalent: when only month is given the controller derives year from
// now.getFullYear(), so "12" silently becomes "2026-10" and every month
// assertion passes against October. The combined form is the one the boundary
// math actually has to handle.
const estimate = async (year, month) => {
  const res = await request(http)
    .get(`/api/payroll/estimate/${employeeId}`)
    .query({ month: `${year}-${String(month).padStart(2, "0")}` })
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body;
};

const datesOf = (body) => body.attendanceRecords.map((r) => iso(r.date));

describe("payrollController.estimateSalary month boundaries", () => {
  test("December 2026 stops before 1 Jan (year rollover)", async () => {
    const body = await estimate(2026, 12);

    expect(datesOf(body)).toEqual(["2026-12-01", "2026-12-31"]);
    expect(body.month).toBe("2026-12");
  });

  test("January 2027 stops before 1 Feb", async () => {
    const body = await estimate(2027, 1);

    expect(datesOf(body)).toEqual(["2027-01-01", "2027-01-31"]);
  });

  test("November 2026 excludes the next month's days", async () => {
    const body = await estimate(2026, 11);

    expect(datesOf(body)).toEqual(["2026-11-30"]);
  });

  test("February 2027 does not inherit January's rows", async () => {
    const body = await estimate(2027, 2);

    expect(datesOf(body)).toEqual(["2027-02-01"]);
  });

  test("pay scales with the days returned, so a wrong bound changes the payout", async () => {
    const dec = await estimate(2026, 12);
    const jan = await estimate(2027, 1);
    const feb = await estimate(2027, 2);

    expect(dec.daysPresent).toBe(2);
    expect(jan.daysPresent).toBe(2);
    expect(feb.daysPresent).toBe(1);

    // Same day count, same monthly salary -> identical daily rate and payout.
    expect(dec.dailyRate).toBeCloseTo(jan.dailyRate, 4);
    expect(dec.totalEarned).toBe(jan.totalEarned);

    // One day is not half of two, because the daily rate uses a per-month
    // denominator: February has 28 days, December and January have 31. The
    // relationship that must hold is totalEarned == dailyRate * daysPresent.
    expect(feb.totalEarned).toBeCloseTo(feb.dailyRate, 4);
    expect(jan.totalEarned).toBeCloseTo(jan.dailyRate * 2, 4);
    // daysInMonth(2027, 2) -> new Date(2027, 2, 0).getDate() === 28.
    expect(feb.totalDays).toBe(28);
    expect(feb.dailyRate).toBeCloseTo(BASE_SALARY / 28, 2);

    // Upper bound must be 2026-12-31 inclusive and 2027-01-01 exclusive.
    // 31 days in December at 1000/day gives 2000, not 2066.67 which 29 days
    // would.
    expect(dec.totalDays).toBe(31);
    expect(dec.dailyRate).toBeCloseTo(BASE_SALARY / 31, 2);
    expect(dec.totalEarned).toBeCloseTo(dec.dailyRate * 2, 2);
  });
});
