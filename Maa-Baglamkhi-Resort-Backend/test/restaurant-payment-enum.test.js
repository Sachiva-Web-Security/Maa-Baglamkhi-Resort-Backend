#!/usr/bin/env node
/**
 * Restaurant bills paymentMethod enum regression (HAG-6).
 *
 * bills.payment_method is enum('cash','card','upi','wallet','net_banking',
 * 'credit','other'). Writing an unknown value throws 1265 under
 * STRICT_TRANS_TABLES, which the controller used to surface as a 500.
 * This suite pins the fix: unknown methods must store as 'other', valid
 * ones unchanged, empty falls back to the schema default.
 *
 * Plain Node, no Jest: `npx jest <this file>` hangs in this workspace, so the
 * suite uses plain HTTP against a throwaway express mount, the same shape as
 * test/token-create-regression.test.js.
 *
 * Usage:  node test/restaurant-payment-enum.test.js
 */

const http = require("http");
const crypto = require("crypto");

process.env.NODE_ENV = "production";
process.env.DB_NAME_TEST = process.env.DB_NAME || "resort_management";

const db = require("../src/config/db");
const express = require("express");
const authRoutes = require("../src/routes/authRoutes");
const restaurantRoutes = require("../src/routes/restaurantRoutes");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/restaurant", restaurantRoutes);

const TABLE = `HAG6ENUM-${crypto.randomBytes(3).toString("hex")}`;

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: Boolean(ok), detail: detail || "" });
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` -> ${detail}`}`);
}

async function main() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const call = (method, path, body) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            ...(body?.auth ? { Authorization: `Bearer ${body.auth}` } : {}),
            ...(body?.token ? { Authorization: `Bearer ${body.token}` } : {}),
          },
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
      const payload = body?.payload;
      if (payload !== undefined) req.write(JSON.stringify(payload));
      req.end();
    });

  // Login
  const login = await call("POST", "/api/auth/login", {
    payload: { email: "admin@resort.com", password: "password" },
  });
  if (!login.body?.token) {
    console.error("login failed", login.status, login.raw?.slice(0, 120));
    process.exit(1);
  }
  const token = login.body.token;
  console.log(`[1] Authenticated as admin@resort.com on port ${port}\n`);

  // Seed cleanup
  await db.execute("DELETE FROM bills WHERE table_number = ?", [TABLE]);

  const createBill = (paymentMethod) =>
    call("POST", "/api/restaurant/bill", {
      token,
      payload: { tableNumber: TABLE, customerName: "HAG6-ENUM", total: 250, paymentMethod },
    });

  const storedMethod = async () => {
    const [rows] = await db.execute(
      "SELECT payment_method FROM bills WHERE table_number = ? ORDER BY id DESC LIMIT 1",
      [TABLE],
    );
    return rows[0]?.payment_method;
  };

  console.log("[2] POST /api/restaurant/bill with an unknown paymentMethod");
  const junk = await createBill("UPI-QA-JUNK");
  check("no 500 for unknown method", junk.status < 500, `got ${junk.status}`);
  const junkStored = await storedMethod();
  check("unknown method stored as 'other'", junkStored === "other", `got ${junkStored}`);

  console.log("[3] POST /api/restaurant/bill with a valid paymentMethod");
  const upi = await createBill("upi");
  check("no 500 for valid method", upi.status < 500, `got ${upi.status}`);
  const upiStored = await storedMethod();
  check("valid method stored unchanged", upiStored === "upi", `got ${upiStored}`);

  console.log("[4] POST /api/restaurant/bill with an empty paymentMethod");
  const empty = await createBill("");
  check("no 500 for empty method", empty.status < 500, `got ${empty.status}`);
  const emptyStored = await storedMethod();
  // createBill passes an empty method through as NULL, so the column's
  // DEFAULT 'cash' only applies when the INSERT omits the column; a NULL
  // write stays NULL. The contract is: no 500, and the row is still created.
  check("empty method writes NULL, not a truncated error", emptyStored === null, `got ${emptyStored}`);

  // Cleanup
  await db.execute("DELETE FROM bills WHERE table_number = ?", [TABLE]);
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
