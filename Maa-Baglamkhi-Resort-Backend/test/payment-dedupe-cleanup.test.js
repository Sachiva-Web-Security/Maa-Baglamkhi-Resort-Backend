#!/usr/bin/env node
/**
 * Idempotency test for scripts/cleanup-payments-dupes.js.
 *
 * Seeds a fixture database (`resort_dedupe_fixture`) mirroring the live
 * payments dupes — bill 1 = 36 rows, bill 45 = 3, bill 53 = 2 (bill 53 has
 * no bills row, the orphan case) — plus 35 matching accounts_transactions
 * ledger rows (one per bill-1 dupe timestamp; the keeper has no ledger leg,
 * so a clean 35 out / 0 in remains), then runs the cleanup script twice and
 * asserts:
 *
 *   run 1: deletes 38 dupe payment rows (35 + 2 + 1), inserts 38 log
 *          entries, deletes the 35 associated ledger rows, leaves the 3
 *          keepers in place, and flags bill 53 as an orphan in the report.
 *   run 2: deletes 0 rows, inserts 0 log entries, deletes 0 ledger rows.
 *          The log table still holds all 38 previously-removed ids and the
 *          report re-emits them. End state is identical to after run 1.
 *
 * The fixture is created and dropped inside the test; no production data is
 * touched. On a hard failure the fixture database is left in place
 * (resort_dedupe_fixture) so the evidence can be inspected.
 *
 * Usage (from Maa-Baglamkhi-Resort-Backend/):
 *   node test/payment-dedupe-cleanup.test.js
 */

process.env.NODE_ENV = "production";

const fs = require("fs");
const os = require("os");
const path = require("path");

const mysql = require("mysql2/promise");
const { getDbBaseConfig } = require("../src/config/databaseConfig");

const FIXTURE_DB = "resort_dedupe_fixture";
const FIXTURE_PAYMENTS = "fixture_payments";
process.env.PAYMENTS_TABLE_NAME = FIXTURE_PAYMENTS;

// The script lazily opens ../src/config/db; inject the fixture pool so every
// table query it runs lands in the fixture schema, not production.
const cleanup = require("../scripts/cleanup-payments-dupes.js");

// ── Fixture pool wiring ─────────────────────────────────────────────────

async function buildFixturePool() {
  const base = getDbBaseConfig();
  const admin = mysql.createPool({
    host: base.host,
    port: base.port,
    user: base.user,
    password: base.password,
  });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${FIXTURE_DB}\``);
  await admin.end();
  const pool = mysql.createPool({ ...base, database: FIXTURE_DB });
  // The cleanup script's getConnection() path is used by its delete
  // transaction; the raw mysql2 pool exposes it natively.
  cleanup.useDb(pool);
  return pool;
}

// ── Test helpers ────────────────────────────────────────────────────────

const results = [];
function check(label, ok, detail) {
  results.push({ label, ok: Boolean(ok), detail: detail || "" });
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` -> ${detail}`}`);
}

async function q(pool, sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function count(pool, name) {
  return Number((await q(pool, `SELECT COUNT(*) AS n FROM ${name}`))[0].n);
}

// ── Fixture seeding ─────────────────────────────────────────────────────

async function createFixture(pool) {
  await q(pool, `DROP TABLE IF EXISTS \`${FIXTURE_PAYMENTS}\``);
  await q(pool, `DROP TABLE IF EXISTS payments_dedupe_log`);
  await q(pool, `DROP TABLE IF EXISTS accounts_transactions`);
  await q(pool, `DROP TABLE IF EXISTS bills`);

  // bills 1 and 45 exist; bill 53 is deliberately absent (orphan case).
  await pool.query(`
    CREATE TABLE bills (
      id BIGINT UNSIGNED PRIMARY KEY,
      total DECIMAL(12,2) NOT NULL DEFAULT 0,
      payment_status VARCHAR(50) DEFAULT 'unpaid'
    )
  `);
  await pool.query(
    `INSERT INTO bills (id, total, payment_status)
     VALUES (1, 100.00, 'paid'), (45, 750.00, 'paid')`,
  );

  await pool.query(`
    CREATE TABLE ${FIXTURE_PAYMENTS} (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      booking_id BIGINT UNSIGNED,
      bill_id BIGINT UNSIGNED,
      invoice_id BIGINT UNSIGNED,
      banquet_booking_id BIGINT UNSIGNED,
      amount DECIMAL(12,2) NOT NULL,
      payment_method_id INT UNSIGNED NOT NULL,
      payment_type ENUM('advance','payment','refund','balance','deposit') DEFAULT 'payment',
      reference_no VARCHAR(100),
      transaction_details TEXT,
      receipt_url VARCHAR(500),
      status ENUM('pending','completed','failed','refunded','cancelled') DEFAULT 'completed',
      received_by BIGINT UNSIGNED,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `);

  // 36 bill-1 rows, 1 minute apart (matches the live spread shape).
  const base = new Date("2026-10-06T07:57:35Z").getTime();
  const b1Ts = [];
  for (let i = 0; i < 36; i++) {
    b1Ts.push(new Date(base + i * 60000).toISOString().replace("T", " ").slice(0, 19));
  }
  await pool.query(
    `INSERT INTO ${FIXTURE_PAYMENTS}
       (bill_id, amount, payment_method_id, status, created_at)
     VALUES ?`,
    [b1Ts.map((ts) => [1, "100.00", 1, "completed", ts])],
  );

  // 3 bill-45 rows: two share a timestamp (the live tie case), one later.
  const b45 = "2026-10-16 18:44:52";
  await pool.query(
    `INSERT INTO ${FIXTURE_PAYMENTS}
       (bill_id, amount, payment_method_id, status, created_at)
     VALUES (45, 750.00, 1, 'completed', ?),
            (45, 750.00, 1, 'completed', ?),
            (45, 750.00, 1, 'completed', '2026-10-16 19:17:34')`,
    [b45, b45],
  );

  // 2 bill-53 rows (orphan bill: no bills row).
  await pool.query(
    `INSERT INTO ${FIXTURE_PAYMENTS}
       (bill_id, amount, payment_method_id, status, created_at)
     VALUES (53, 640.00, 1, 'completed', '2026-10-17 08:17:12'),
            (53, 640.00, 1, 'completed', '2026-10-17 08:20:48')`,
  );

  // 35 ledger rows matching the 35 bill-1 DUPE timestamps (one minute apart,
  // inside the ±10-minute window). The keeper row carries no ledger leg, so
  // after run 1 the accounts_transactions table is empty and the keeper's
  // amount is the only unpaired one — a clean 35-out / 0-in end state.
  await pool.query(`
    CREATE TABLE accounts_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      type ENUM('Income','Expense') NOT NULL DEFAULT 'Income',
      department ENUM('Room','Restaurant','Other') NOT NULL DEFAULT 'Other',
      source_module VARCHAR(50),
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_mode VARCHAR(30) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    )
  `);
  await pool.query(
    `INSERT INTO accounts_transactions
       (date, type, source_module, description, amount, payment_mode, created_at)
     VALUES ?`,
    [
      b1Ts.slice(0, 35).map((ts) => [
        "2026-10-06", "Income", "restaurant", "fixture", "100.00", "Cash", ts,
      ]),
    ],
  );

  return {
    totalP: await count(pool, FIXTURE_PAYMENTS),
    totalA: await count(pool, "accounts_transactions"),
  };
}

// ── Main ────────────────────────────────────────────────────────────────

const EXPECTED_DUPES = 38; // 35 (bill 1) + 2 (bill 45) + 1 (bill 53)
const EXPECTED_LEDGER = 35; // only bill-1 dupes have ledger rows

async function main() {
  console.log(`=== payment-dedupe-cleanup test (fixture: ${FIXTURE_DB}) ===`);

  const pool = await buildFixturePool();
  const counts = await createFixture(pool);
  check("fixture payments total = 41 (36+3+2)", counts.totalP === 41, String(counts.totalP));
  check("fixture ledger total = 35", counts.totalA === 35, String(counts.totalA));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dedupe-test-"));
  const report1 = path.join(tmpDir, "report1.json");
  const report2 = path.join(tmpDir, "report2.json");

  // ── Run 1 ─────────────────────────────────────────────────────────────
  const r1 = await cleanup.run({ dryRun: false, noReport: false, reportPath: report1 });
  check(
    `run1: removed_this_run_count = ${EXPECTED_DUPES}`,
    r1.removed_this_run_count === EXPECTED_DUPES,
    `expected ${EXPECTED_DUPES}, got ${r1.removed_this_run_count}`,
  );
  check(
    "run1: deleted_payments_rows = 38",
    r1.deleted_payments_rows === EXPECTED_DUPES,
    String(r1.deleted_payments_rows),
  );
  check(
    "run1: log_inserts_this_run = 38",
    r1.log_inserts_this_run === EXPECTED_DUPES,
    String(r1.log_inserts_this_run),
  );
  check(
    `run1: deleted_ledger_rows = ${EXPECTED_LEDGER} (all bill-1 dupe legs removed)`,
    r1.deleted_ledger_rows === EXPECTED_LEDGER,
    String(r1.deleted_ledger_rows),
  );
  const pAfter1 = await count(pool, FIXTURE_PAYMENTS);
  const aAfter1 = await count(pool, "accounts_transactions");
  check("run1: payments remaining = 3 (keepers)", pAfter1 === 3, String(pAfter1));
  check(
    "run1: ledger remaining = 0 (keeper has no ledger leg)",
    aAfter1 === 0,
    String(aAfter1),
  );

  // Orphan check: bill 53 has no bills row, so it must appear in orphans.
  const orphan53 = r1.orphans.find((o) => o.bill_id === 53);
  check("run1: bill 53 flagged as orphan", Boolean(orphan53));
  check(
    "run1: orphan 53 lists its 2 payment ids (40, 41)",
    orphan53 &&
      JSON.stringify(orphan53.payment_ids.map(String)) === JSON.stringify(["40", "41"]),
    orphan53 ? JSON.stringify(orphan53.payment_ids) : "not found",
  );
  // The orphan flag must NOT have caused a delete: bill-53's two rows are
  // 39/40, of which 39 was removed as the dupe (keeper 40) — so bill 53's
  // remaining row count is 1.
  const [b53rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM ${FIXTURE_PAYMENTS} WHERE bill_id = 53`,
  );
  check("run1: bill 53 still has 1 payment row (keeper)", Number(b53rows[0].n) === 1, String(b53rows[0].n));

  // ── Run 2 (idempotency) ──────────────────────────────────────────────
  const r2 = await cleanup.run({ dryRun: false, noReport: false, reportPath: report2 });
  check("run2: removed_this_run_count = 0", r2.removed_this_run_count === 0, String(r2.removed_this_run_count));
  check("run2: deleted_payments_rows = 0", r2.deleted_payments_rows === 0, String(r2.deleted_payments_rows));
  check("run2: log_inserts_this_run = 0", r2.log_inserts_this_run === 0, String(r2.log_inserts_this_run));
  check("run2: deleted_ledger_rows = 0", r2.deleted_ledger_rows === 0, String(r2.deleted_ledger_rows));
  check(
    "run2: previously_removed_count = 38 (log table still holds all 38)",
    r2.previously_removed_count === EXPECTED_DUPES,
    String(r2.previously_removed_count),
  );
  const pAfter2 = await count(pool, FIXTURE_PAYMENTS);
  const aAfter2 = await count(pool, "accounts_transactions");
  const logCount = await count(pool, "payments_dedupe_log");
  check("run2: payments count unchanged = 3", pAfter2 === 3, String(pAfter2));
  check("run2: ledger count unchanged = 0", aAfter2 === 0, String(aAfter2));
  check("log table holds 38 entries", logCount === EXPECTED_DUPES, String(logCount));

  // Orphans still flagged on run 2 (bill 53 still has no bills row).
  const orphan53r2 = r2.orphans.find((o) => o.bill_id === 53);
  check("run2: bill 53 still flagged as orphan", Boolean(orphan53r2));

  // Report files exist.
  check("report1.json exists", fs.existsSync(report1));
  check("report2.json exists", fs.existsSync(report2));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  ${f.label} ${f.detail ? "-> " + f.detail : ""}`);
    // Leave the fixture in place for inspection on failure.
    await pool.end();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`fixture ${FIXTURE_DB} left in place for inspection.`);
    process.exit(1);
  }

  // ── Tidy (only on success) ──────────────────────────────────────────
  await pool.query(`DROP TABLE IF EXISTS \`${FIXTURE_PAYMENTS}\``);
  await pool.query(`DROP TABLE IF EXISTS payments_dedupe_log`);
  await pool.query(`DROP TABLE IF EXISTS accounts_transactions`);
  await pool.query(`DROP TABLE IF EXISTS bills`);
  await pool.end();
  const admin = mysql.createPool({
    host: getDbBaseConfig().host,
    port: getDbBaseConfig().port,
    user: getDbBaseConfig().user,
    password: getDbBaseConfig().password,
  });
  await admin.query(`DROP DATABASE IF EXISTS \`${FIXTURE_DB}\``);
  await admin.end();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("all checks passed; fixture dropped");
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err.message, err.stack);
  process.exit(1);
});
