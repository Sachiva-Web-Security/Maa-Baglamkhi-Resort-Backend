const request = require("supertest");

// Jest forces NODE_ENV=test before any test module loads, and under that flag
// databaseConfig resolves DB_NAME_TEST instead of the DB_NAME the app runs
// against. Reset both so this suite hits the real local db, same as
// month-boundary.test.js.
process.env.NODE_ENV = "production";
process.env.DB_NAME_TEST = process.env.DB_NAME || "resort_management";

const db = require("../src/config/db");
const authRoutes = require("../src/routes/authRoutes");
const restaurantRoutes = require("../src/routes/restaurantRoutes");

// buildBillDateFilter is not exported from restaurantController.js, so it is
// driven through GET /api/restaurant/bills, which is its only caller. Three
// bills straddle 2026-10-01 so the midnight edge is observable: two of them
// fall on 2026-10-01 and one on 2026-10-02.
//
// Routes are mounted directly rather than via src/app: app.js pulls in
// middleware/auditLogger.js, where `inferModule` is declared twice, which jest's
// babel transform rejects at load time.
const express = require("express");
const http = express();
http.use(express.json());
http.use("/api/auth", authRoutes);
http.use("/api/restaurant", restaurantRoutes);

const ADMIN = { email: "admin@resort.com", password: "password" };
const MARKER = "HAG34-BILL";

const SEED = [
  { table: "HAG34-A", at: "2026-10-01 09:30:00", amount: 100 },
  { table: "HAG34-B", at: "2026-10-01 23:45:00", amount: 200 },
  { table: "HAG34-C", at: "2026-10-02 10:00:00", amount: 300 },
];

let token;

beforeAll(async () => {
  await db.execute("DELETE FROM bills WHERE table_number LIKE ?", ["HAG34-%"]);
  for (const row of SEED) {
    await db.execute(
      `INSERT INTO bills
         (table_number, customer_name, subtotal, total, payment_method, payment_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.table, `${MARKER} ${row.table}`, row.amount, row.amount, "cash", "unpaid", row.at],
    );
  }

  const { body } = await request(http).post("/api/auth/login").send(ADMIN);
  token = body.token;
});

afterAll(async () => {
  await db.execute("DELETE FROM bills WHERE table_number LIKE ?", ["HAG34-%"]);
});

const billsBetween = async (from, to) => {
  const query = {};
  if (from) query.from = from;
  if (to) query.to = to;
  const res = await request(http)
    .get("/api/restaurant/bills")
    .query(query)
    .set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body
    .filter((b) => String(b.table_number).startsWith("HAG34-"))
    .map((b) => b.table_number)
    .sort();
};

describe("restaurantController.buildBillDateFilter", () => {
  test("from spans midnight, so 2026-10-01 keeps the late day bill", async () => {
    expect(await billsBetween("2026-10-01", "2026-10-02")).toEqual([
      "HAG34-A",
      "HAG34-B",
    ]);
  });

  test("from without a time still admits a 23:45 timestamp on that date", async () => {
    expect(await billsBetween("2026-10-01", null)).toEqual([
      "HAG34-A",
      "HAG34-B",
      "HAG34-C",
    ]);
  });

  test("to is exclusive, so to=2026-10-01 returns nothing from the 1st", async () => {
    expect(await billsBetween("2025-01-01", "2026-10-01")).toEqual([]);
  });

  test("to=2026-10-02 closes at the midnight before the 2nd", async () => {
    expect(await billsBetween("2026-01-01", "2026-10-02")).toEqual([
      "HAG34-A",
      "HAG34-B",
    ]);
  });

  test("a window covering the next day admits the 2026-10-02 bill", async () => {
    expect(await billsBetween("2026-01-01", "2026-10-03")).toEqual([
      "HAG34-A",
      "HAG34-B",
      "HAG34-C",
    ]);
  });

  test("malformed dates are ignored rather than thrown", async () => {
    expect(await billsBetween("2026-10-1", "10-01-2026")).toEqual([
      "HAG34-A",
      "HAG34-B",
      "HAG34-C",
    ]);
  });
});
