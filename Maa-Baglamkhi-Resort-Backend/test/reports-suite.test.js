#!/usr/bin/env node
/**
 * Reports suite gate (HAG-66).
 *
 * Plain-node suite in the write-probe shape: a throwaway express mount
 * (auth + /api/reports-suite, same as bill-date-filter.test.js), a real
 * admin login, then one check per reports-suite endpoint — all 33 of them
 * (19 original + 14 extension) in JSON and CSV shapes. No rows are written
 * except the night-audit snapshot upsert, which is additive.
 *
 * Usage:  node test/reports-suite.test.js
 */

const express = require("express");
const request = require("supertest");

process.env.NODE_ENV = "production";
process.env.DB_NAME_TEST = process.env.DB_NAME || "resort_management";

const authRoutes = require("../src/routes/authRoutes");
const reportsSuiteRoutes = require("../src/routes/reportsSuiteRoutes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/reports-suite", reportsSuiteRoutes);

const ADMIN = { email: "admin@resort.com", password: "password" };

const ENDPOINTS = [
  // original 19
  "mis", "invoice-register", "service-wise", "room-occupancy", "rooms-all",
  "rooms-checkin", "rooms-checkout", "company-ledger", "room-history",
  "room-performance", "guest-list-police", "housekeeping-history",
  "maintenance-history", "general-ledger", "cashbook-summary", "night-audit",
  "cash-summary", "refund-collection", "stock-summary",
  // 14 extension (HAG-66)
  "collection-report", "item-wise", "invoice-group-wise", "sales-by-guest",
  "sales-by-order-type", "due-list", "table-wise", "nc-sales", "parcel-sales",
  "void-kot-history", "refund-item-summary", "pax", "day-end-summary",
  "feedback-analytics",
];

let failed = 0;
function check(desc, ok, detail = "") {
  if (ok) console.log(`  ok  ${desc}`);
  else {
    failed += 1;
    console.error(`FAIL  ${desc} ${detail}`);
  }
}

async function main() {
  const login = await request(app).post("/api/auth/login").send(ADMIN);
  const token = login.body.token;
  check("login as admin", Boolean(token), `status=${login.status}`);

  const q = "from=2026-01-01&to=2026-10-31";

  for (const key of ENDPOINTS) {
    // JSON shape
    const r = await request(app)
      .get(`/api/reports-suite/${key}?${q}`)
      .set("Authorization", `Bearer ${token}`);
    check(`GET /${key} json`, r.status === 200 && r.body.report === key && Array.isArray(r.body.rows),
      `status=${r.status} body=${JSON.stringify(r.body).slice(0, 160)}`);

    // CSV shape
    const c = await request(app)
      .get(`/api/reports-suite/${key}?${q}&format=csv`)
      .set("Authorization", `Bearer ${token}`);
    const ct = c.headers["content-type"] || "";
    const cd = c.headers["content-disposition"] || "";
    check(`GET /${key} csv`,
      c.status === 200 && ct.includes("text/csv") && cd.includes("attachment") && c.text.includes(","),
      `status=${c.status} ct=${ct} cd=${cd}`);
  }

  // default window (no ?from&to) must also work on one representative endpoint
  const d = await request(app)
    .get("/api/reports-suite/collection-report")
    .set("Authorization", `Bearer ${token}`);
  check("GET /collection-report default window", d.status === 200 && d.body.report === "collection-report",
    `status=${d.status}`);

  // auth gate: no token → 401
  const u = await request(app).get("/api/reports-suite/mis");
  check("reports-suite 401 without token", u.status === 401, `status=${u.status}`);

  console.log(failed === 0 ? "reports-suite: all checks pass" : `reports-suite: ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
