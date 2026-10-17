#!/usr/bin/env node
/**
 * tokenController status-literal regression test.
 *
 * tokens.status is enum('active','completed','cancelled','expired'). Writing a
 * value outside that set throws 1265 under STRICT_TRANS_TABLES, which
 * createToken surfaces as the 500 "Token creation failed" this route used to
 * return whenever a table already held an open token. Sending
 * POST /api/token/create twice for the same table must both succeed: the first
 * an insert, the second a 200 "already active" idempotent reply.
 *
 * Every status literal createToken and closeTokenByTable can write is
 * exercised here and read back out of the database, so a bad literal is caught
 * at the database rather than reasoned about.
 *
 * Plain Node, no Jest: `npx jest <this file>` hangs in this workspace for
 * unrelated reasons, so the suite uses plain HTTP with its own expectations,
 * the same shape as test/write-probe.test.js.
 *
 * Usage:  node test/token-create-regression.test.js
 */

const http = require("http");

// NODE_ENV=test makes databaseConfig resolve DB_NAME_TEST instead of the schema
// the app actually runs against. This box has no such database, and a stale
// DB_NAME_TEST pointing elsewhere would be worse, because several table names
// collide and every write would silently land in the wrong schema.
process.env.NODE_ENV = "production";
process.env.DB_NAME_TEST = process.env.DB_NAME || "resort_management";

const db = require("../src/config/db");
const express = require("express");
const tokenRoutes = require("../src/routes/tokenRoutes");
const authRoutes = require("../src/routes/authRoutes");

// Routes are mounted directly rather than via src/app: app.js pulls in
// middleware/auditLogger.js, where `inferModule` is declared twice. Node accepts
// the duplicate, but jest's babel transform does not. Out of scope here.
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/token", tokenRoutes);

const ADMIN = { email: "admin@resort.com", password: "password" };
const MARKER = `__REG${Date.now().toString(36).toUpperCase()}_`;
const TABLE = MARKER + "TBL";
const TOKEN_STATUS_ENUM = ["active", "completed", "cancelled", "expired"];

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: Boolean(ok), detail: detail || "" });
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` -> ${detail}`}`);
}

let token = null;
let port = 0;

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request(
      { hostname: "127.0.0.1", port, path, method, headers, timeout: 30000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
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

const statusOfTable = async () => {
  const [rows] = await db.query(
    `SELECT id, status FROM tokens WHERE table_number = ? ORDER BY id DESC LIMIT 1`,
    [TABLE]
  );
  return rows[0] || null;
};

async function main() {
  const listener = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => listener.once("listening", resolve));
  port = listener.address().port;

  const login = await api("POST", "/api/auth/login", ADMIN);
  if (login.status !== 200 || !login.body?.token) {
    throw new Error(`login failed: ${login.status} ${login.raw?.slice(0, 120)}`);
  }
  token = login.body.token;
  console.log(`\n[1] Authenticated as ${ADMIN.email} on port ${port}\n`);

  console.log("[2] Two creates in a row on the same table");
  const first = await api("POST", "/api/token/create", { tableNumber: TABLE, waiter: "Regression" });
  check("first POST /api/token/create is a 200, not the 500", first.status === 200,
    `got ${first.status} ${first.raw?.slice(0, 160)}`);
  check("first create reports a new token", first.body?.existing === false,
    `got ${JSON.stringify(first.body).slice(0, 160)}`);
  check("first token_code was just generated", typeof first.body?.tokenCode === "string" && first.body.tokenCode.startsWith("VIS-"),
    `got ${first.body?.tokenCode}`);

  const second = await api("POST", "/api/token/create", { tableNumber: TABLE, waiter: "Regression" });
  check("second POST /api/token/create is a 200, not the 500", second.status === 200,
    `got ${second.status} ${second.raw?.slice(0, 160)}`);
  check("second create reports the existing token", second.body?.existing === true,
    `got ${JSON.stringify(second.body).slice(0, 160)}`);
  check("second create returns the same token id", Number(second.body?.tokenId) === Number(first.body?.tokenId),
    `first=${first.body?.tokenId} second=${second.body?.tokenId}`);

  console.log("\n[3] Status written by the open-token insert is in the enum");
  const open = await statusOfTable();
  check("open token status is inside tokens.status enum", open ? TOKEN_STATUS_ENUM.includes(open.status) : false,
    `status=${open?.status} allowed=${TOKEN_STATUS_ENUM.join(",")}`);

  console.log("\n[4] Close writes a status inside the enum");
  const close = await api("PUT", `/api/token/close/${TABLE}`);
  check("PUT /api/token/close/:table is a 200, not the 500", close.status === 200,
    `got ${close.status} ${close.raw?.slice(0, 160)}`);
  const closed = await statusOfTable();
  check("closed token status is inside tokens.status enum", closed ? TOKEN_STATUS_ENUM.includes(closed.status) : false,
    `status=${closed?.status} allowed=${TOKEN_STATUS_ENUM.join(",")}`);

  console.log("\n[5] Close-before-reopen writes a status inside the enum");
  const reopen = await api("POST", "/api/token/create", { tableNumber: TABLE, waiter: "Regression" });
  check("create after close is a 200, not the 500", reopen.status === 200,
    `got ${reopen.status} ${reopen.raw?.slice(0, 160)}`);
  const reopened = await statusOfTable();
  check("reopened token status is inside tokens.status enum", reopened ? TOKEN_STATUS_ENUM.includes(reopened.status) : false,
    `status=${reopened?.status} allowed=${TOKEN_STATUS_ENUM.join(",")}`);

  console.log("\n[6] Cleanup — delete only this suite's rows");
  await db.query(`DELETE FROM tokens WHERE table_number LIKE ?`, [`${MARKER}%`]);
  check("probe rows removed", (await statusOfTable()) === null, "rows still present");

  listener.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log("\n" + "=".repeat(72));
  console.log(` TOKEN STATUS REGRESSION: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(72));

  if (failed) {
    console.log("\n FAILURES:");
    results.filter((r) => !r.ok).forEach((f) => console.log(`   - ${f.label}\n       ${f.detail}`));
  }

  await db.pool.end();
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch(async (err) => {
  console.error("Probe crashed:", err);
  try {
    await db.query(`DELETE FROM tokens WHERE table_number LIKE ?`, [`${MARKER}%`]);
  } catch {
    /* db already down */
  }
  process.exitCode = 1;
});
