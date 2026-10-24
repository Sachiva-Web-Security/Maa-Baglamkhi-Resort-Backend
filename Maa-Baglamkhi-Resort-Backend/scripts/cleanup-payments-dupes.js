#!/usr/bin/env node
/**
 * One-shot historical dupe cleanup for the `payments` table.
 *
 * Live `resort_management.payments` holds historical duplicates that the code
 * guards (HAG-43, commit bd89562) only prevent going forward. Observed state
 * at 2026-10-24: bill 1 = 36 rows, bill 45 = 3 rows, bill 53 = 2 rows, plus
 * unlinked (bill_id IS NULL) rows and bill 53 pointing at a deleted bill.
 *
 * What this script does (idempotent, safe to run twice):
 *   1. Ensures the `payments_dedupe_log` audit table exists (add-only DDL;
 *      nothing is ever dropped).
 *   2. Finds dupe groups: rows sharing (bill_id, amount, status) with more
 *      than one row. A NULL bill_id forms its own class (NULL never equals a
 *      bill id), so linked and unlinked payments never merge across classes.
 *   3. Keeps the most recent row of each group (MAX(created_at), ties broken
 *      by MAX(id)) and records every removed row in the log table
 *      (INSERT IGNORE on a UNIQUE payment_id, so a repeat run is a no-op).
 *   4. Deletes the duplicates in one transaction, in 100-id chunks. For each
 *      removed payment row, the matching accounts_transactions ledger row
 *      (source_module='restaurant', type='Income', same amount, created
 *      within ±10 minutes of the payment's created_at) is recorded in the
 *      report and deleted in the same transaction, so the bookkeeping leg of
 *      a removed payment does not outlive it. Restaurant bill-only dupes
 *      (bills 1/45/53) have no ledger row within the window and simply do
 *      not match — the delete is a no-op for them.
 *   5. Writes a report JSON covering BOTH the rows removed on this run and
 *      the previously removed ones (re-read from the log table), so a second
 *      run still emits the complete picture. Orphaned payments (bill_id
 *      present but no bills row) are flagged in the report, never deleted.
 *
 * Idempotency contract: run the same command N times — end state is
 * identical after the first run. A second run finds no dupe groups, deletes
 * zero payment rows and zero ledger rows, inserts zero log rows, and still
 * writes the report (from the log table + the orphan scan).
 *
 * Invocation (from Maa-Baglamkhi-Resort-Backend/, DB creds via .env or env):
 *
 *   DRY RUN (report only, no deletions, no log writes):
 *     node scripts/cleanup-payments-dupes.js --dry-run
 *
 *   REAL RUN:
 *     node scripts/cleanup-payments-dupes.js
 *
 *   Options:
 *     --report <path>   report file (default reports/payments-dedupe-report.json)
 *     --no-report       skip writing the report file (log table still updated)
 *     --dry-run         compute groups + orphans, write nothing, delete nothing
 *
 * Boundary rules honored: no changes to src/ guard logic, no migration that
 * drops columns. Deletions happen one transaction at a time.
 *
 * Testing: the module exports `run` so test/payment-dedupe-cleanup.test.js
 * can point it at a fixture DB (via env overrides) and prove idempotency
 * without touching production data. CLI mode is the only way to run it
 * against the live database.
 */

const fs = require("fs");
const path = require("path");

const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME || "payments";
const BILLS_TABLE = "bills";
const LOG_TABLE = "payments_dedupe_log";
const ACCOUNTS_TABLE = "accounts_transactions";
const LEDGER_WINDOW_SECONDS = 600;

// ── Test-mode injection seam (lazy: DB is only opened when run() is called)
//
// Production runs use the shared db.js pool; tests set this before calling
// run() so the script can run against a fixture database instead.
let dbOverride = null;
function useDb(instance) {
  dbOverride = instance;
}
function getDb() {
  if (dbOverride) return dbOverride;
  // Lazy require so test-mode can inject before the pool is created.
  return (dbLazy = dbLazy || require("../src/config/db"));
}
let dbLazy = null;

// ── Log table bootstrap (add-only; idempotent) ──────────────────────────

async function ensureLogTable(db) {
  const [tables] = await db.query("SHOW TABLES LIKE ?", [LOG_TABLE]);
  if (tables && tables.length) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${LOG_TABLE} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      payment_id BIGINT UNSIGNED NOT NULL,
      bill_id BIGINT UNSIGNED,
      amount DECIMAL(12,2) NOT NULL,
      status VARCHAR(30) NOT NULL,
      created_at TIMESTAMP NULL,
      reason VARCHAR(255) NOT NULL DEFAULT 'historical_duplicate',
      removed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_payment_id (payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

// ── Group detection ─────────────────────────────────────────────────────
//
// Group key = (bill_id IS NULL, COALESCE(bill_id,0), amount, status). Rows
// come back ordered by that key then created_at DESC, id DESC, so the FIRST
// row seen for a key is the keeper (most recent, highest id on tie); every
// later row in the same key is a duplicate.

async function findDupeGroups(db) {
  const [rows] = await db.query(
    `
      SELECT p.id, p.bill_id, p.amount, p.status, p.created_at,
             p.booking_id, p.invoice_id, p.banquet_booking_id
      FROM ${PAYMENTS_TABLE} p
      ORDER BY (p.bill_id IS NULL) ASC,
               COALESCE(p.bill_id, 0) ASC,
               p.amount ASC,
               p.status ASC,
               p.created_at DESC,
               p.id DESC
    `,
  );

  const groups = [];
  const byKey = new Map();
  for (const row of rows) {
    const isNull = row.bill_id === null;
    const key = isNull
      ? `NULL|${row.amount}|${row.status}`
      : `${row.bill_id}|${row.amount}|${row.status}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        bill_id: row.bill_id,
        amount: String(row.amount),
        status: row.status,
        keeper: {
          id: Number(row.id),
          created_at: row.created_at,
          booking_id: row.booking_id,
          invoice_id: row.invoice_id,
          banquet_booking_id: row.banquet_booking_id,
        },
        dupes: [],
      };
      byKey.set(key, g);
      groups.push(g);
    } else {
      g.dupes.push({
        id: Number(row.id),
        created_at: row.created_at,
        amount: g.amount,
        status: g.status,
        bill_id: row.bill_id,
        booking_id: row.booking_id,
        invoice_id: row.invoice_id,
        banquet_booking_id: row.banquet_booking_id,
      });
    }
  }
  return groups.filter((g) => g.dupes.length > 0);
}

// ── Orphans: bill_id present but no bills row ───────────────────────────
//
// List ids in a bounded second query per bill, not via GROUP_CONCAT
// (truncates at ~1KB on large id sets).

async function findOrphanBills(db) {
  const [billRows] = await db.query(
    `
      SELECT p.bill_id, COUNT(*) AS n
      FROM ${PAYMENTS_TABLE} p
      LEFT JOIN ${BILLS_TABLE} b ON b.id = p.bill_id
      WHERE p.bill_id IS NOT NULL AND b.id IS NULL
      GROUP BY p.bill_id
      ORDER BY p.bill_id
    `,
  );
  const orphans = [];
  for (const row of billRows) {
    const billId = Number(row.bill_id);
    const [ids] = await db.query(
      `SELECT id FROM ${PAYMENTS_TABLE} WHERE bill_id = ? ORDER BY id`,
      [billId],
    );
    orphans.push({
      bill_id: billId,
      payment_count: Number(row.n),
      payment_ids: ids.map((r) => Number(r.id)),
    });
  }
  return orphans;
}

// ── Associated ledger rows ──────────────────────────────────────────────
//
// For each removed payment row, the matching accounts_transactions INSERT
// that processBillPayment wrote: source_module='restaurant', type='Income',
// same amount, created within ±LEDGER_WINDOW_SECONDS of the payment's
// created_at. Rows with no ref (bill/booking/invoice/banquet) are skipped —
// restaurant bill-only dupes never have a ledger row in the window.

async function findLedgerRows(db, paymentDupes) {
  const out = [];
  for (const p of paymentDupes) {
    const ref =
      p.booking_id ?? p.invoice_id ?? p.banquet_booking_id ?? p.bill_id;
    if (ref === null || ref === undefined) continue;
    const [rows] = await db.query(
      `
        SELECT id, amount, description, payment_mode, created_at
        FROM ${ACCOUNTS_TABLE}
        WHERE source_module = 'restaurant'
          AND type = 'Income'
          AND amount = ?
          AND created_at >= DATE_SUB(?, INTERVAL ? SECOND)
          AND created_at <= DATE_ADD(?, INTERVAL ? SECOND)
        ORDER BY id ASC
      `,
      [
        String(p.amount),
        p.created_at,
        LEDGER_WINDOW_SECONDS,
        p.created_at,
        LEDGER_WINDOW_SECONDS,
      ],
    );
    for (const lr of rows) {
      out.push({
        accounts_transactions_id: Number(lr.id),
        for_payment_id: p.id,
        amount: String(lr.amount),
        created_at: lr.created_at,
      });
    }
  }
  return out;
}

// ── Log insertion (idempotent via UNIQUE on payment_id) ─────────────────

async function logRemovedRows(db, rows) {
  if (!rows.length) return 0;
  let inserted = 0;
  for (const r of rows) {
    const [res] = await db.query(
      `
        INSERT IGNORE INTO ${LOG_TABLE}
          (payment_id, bill_id, amount, status, created_at, reason)
        VALUES (?, ?, ?, ?, ?, 'historical_duplicate')
      `,
      [Number(r.id), r.bill_id, String(r.amount), r.status, r.created_at || null],
    );
    inserted += res.affectedRows || 0;
  }
  return inserted;
}

async function readLog(db) {
  const [rows] = await db.query(
    `SELECT payment_id, bill_id, amount, status, created_at, removed_at
     FROM ${LOG_TABLE}
     ORDER BY payment_id ASC`,
  );
  return rows;
}

// ── Delete (single transaction, 100-id chunks) ──────────────────────────

async function deleteInTransaction(db, paymentDupes, ledgerRows) {
  let deletedPayments = 0;
  let deletedLedger = 0;
  const ledgerRowsRemoved = ledgerRows.map((l) => ({ ...l }));

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < paymentDupes.length; i += 100) {
      const chunk = paymentDupes.slice(i, i + 100);
      const ph = chunk.map(() => "?").join(",");
      const [res] = await conn.query(
        `DELETE FROM ${PAYMENTS_TABLE} WHERE id IN (${ph})`,
        chunk.map((d) => d.id),
      );
      deletedPayments += res.affectedRows || 0;
    }
    const ledgerIds = ledgerRows.map((l) => l.accounts_transactions_id);
    if (ledgerIds.length) {
      for (let i = 0; i < ledgerIds.length; i += 100) {
        const chunk = ledgerIds.slice(i, i + 100);
        const ph = chunk.map(() => "?").join(",");
        const [res] = await conn.query(
          `DELETE FROM ${ACCOUNTS_TABLE} WHERE id IN (${ph})`,
          chunk,
        );
        deletedLedger += res.affectedRows || 0;
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return { deletedPayments, deletedLedger, ledgerRowsRemoved };
}

// ── Run (exported so the test can call it against a fixture DB) ────────

async function run({ dryRun, noReport, reportPath } = {}) {
  const db = getDb();
  console.log(`[cleanup-payments-dupes] ${dryRun ? "DRY RUN" : "LIVE"} start`);

  if (!dryRun) await ensureLogTable(db);

  const groups = await findDupeGroups(db);
  const orphans = await findOrphanBills(db);
  const allDupes = groups.flatMap((g) => g.dupes);
  console.log(
    `[cleanup-payments-dupes] dupe groups: ${groups.length}, rows that would be removed: ${allDupes.length}`,
  );
  for (const g of groups) {
    console.log(
      `  bill=${g.bill_id ?? "NULL"} amount=${g.amount} status=${g.status} ` +
        `keep=#${g.keeper.id} remove=${g.dupes.length}`,
    );
  }

  let deletedPayments = 0;
  let deletedLedger = 0;
  let logged = 0;
  let ledgerRows = [];

  if (dryRun) {
    ledgerRows = await findLedgerRows(db, allDupes);
  } else if (allDupes.length) {
    ledgerRows = await findLedgerRows(db, allDupes);
    logged = await logRemovedRows(db, allDupes);
    const r = await deleteInTransaction(db, allDupes, ledgerRows);
    deletedPayments = r.deletedPayments;
    deletedLedger = r.deletedLedger;
    ledgerRows = r.ledgerRowsRemoved;
  }

  const previouslyRemoved = dryRun ? [] : await readLog(db);

  const report = {
    generated_at: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "live",
    payments_table: PAYMENTS_TABLE,
    log_table: dryRun ? null : LOG_TABLE,
    dupe_groups: groups.map((g) => ({
      key: g.key,
      row_count: g.dupes.length + 1,
      keeper_payment_id: g.keeper.id,
      keeper_created_at: g.keeper.created_at,
      removed_payment_ids: g.dupes.map((d) => d.id),
      removed_count: g.dupes.length,
    })),
    removed_this_run: allDupes.map((d) => ({
      payment_id: d.id,
      bill_id: d.bill_id,
      amount: d.amount,
      status: d.status,
      created_at: d.created_at,
    })),
    removed_this_run_count: allDupes.length,
    deleted_payments_rows: deletedPayments,
    ledger_rows_removed: ledgerRows,
    deleted_ledger_rows: deletedLedger,
    log_inserts_this_run: logged,
    previously_removed_count: previouslyRemoved.length,
    previously_removed: previouslyRemoved,
    orphans: orphans.map((o) => ({
      bill_id: o.bill_id,
      flag: "ORPHANED_BILL_NO_BILLS_ROW",
      payment_count: o.payment_count,
      payment_ids: o.payment_ids,
      action: "left-as-is per brief; flagged only",
    })),
    notes: [
      "Keeps the most recent row per (bill_id, amount, status) group; ties broken by highest id.",
      "Orphan payments (bill_id set, no bills row) are left alone and flagged.",
      "Idempotent: re-running deletes 0 rows and re-emits the report from the log table.",
      "For dupes that carry a booking/invoice/banquet_booking ref, the matching accounts_transactions ledger row is removed in the same transaction.",
    ],
  };

  if (!noReport || dryRun) {
    const target = path.resolve(reportPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2));
    console.log(`[cleanup-payments-dupes] report written: ${target}`);
  }

  console.log(
    `[cleanup-payments-dupes] ${dryRun ? "dry-run" : "done"}: ` +
      `deleted ${deletedPayments} payment row(s) + ${deletedLedger} ledger row(s), ` +
      `log now holds ${previouslyRemoved.length} entry(ies).`,
  );

  return report;
}

// ── CLI ────────────────────────────────────────────────────────────────

async function cli() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const noReport = args.includes("--no-report");
  const reportIdx = args.indexOf("--report");
  const reportPath =
    reportIdx !== -1
      ? args[reportIdx + 1]
      : path.resolve(__dirname, "..", "reports", "payments-dedupe-report.json");

  await run({ dryRun, noReport, reportPath });
  const db = getDb();
  if (db && db.end) await db.end();
}

if (require.main === module) {
  cli().catch(async (err) => {
    console.error("[cleanup-payments-dupes] FATAL:", err.message);
    process.exitCode = 1;
    try {
      const db = getDb();
      if (db && db.end) await db.end();
    } catch {
      /* pool already gone */
    }
  });
}

module.exports = { run, useDb, getDb };
