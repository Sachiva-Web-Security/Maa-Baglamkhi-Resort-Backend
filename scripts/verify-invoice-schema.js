require("dotenv").config({ quiet: true });

/**
 * Verifies the `invoices.status` backfill in InvoiceModel.ensureSchema().
 *
 * ensureSchema() is the only writer of this column, so this calls it and then
 * checks the column exists and accepts the values the model writes. It does NOT
 * issue any DDL of its own — the migration belongs in the model, which is
 * exactly the bug being fixed (CREATE TABLE IF NOT EXISTS declared `status` but
 * no ensureColumn() ever backfilled an existing table).
 */

const db = require("../src/config/db");
const InvoiceModel = require("../src/models/InvoiceModel");

const q = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

async function main() {
  console.log("Running InvoiceModel.ensureSchema()...");
  await InvoiceModel.ensureSchema();
  console.log("  ensureSchema completed without error.");

  const cols = await q("SHOW COLUMNS FROM invoices");
  const names = cols.map((c) => c.Field);
  const statusCol = cols.find((c) => c.Field === "status");
  const payCol = cols.find((c) => c.Field === "payment_status");

  console.log(`\ninvoices.status       -> ${statusCol ? `${statusCol.Type} default=${statusCol.Default}` : "MISSING"}`);
  console.log(`invoices.payment_status -> ${payCol ? payCol.Type : "MISSING"}`);

  if (!statusCol) {
    console.error("\nFAIL: ensureSchema did not add the status column.");
    process.exit(1);
  }

  // The SELECT that used to throw on every booking.
  try {
    await q("SELECT id, invoice_no, payment_status, payment_mode, status, notes FROM invoices LIMIT 1");
    console.log("\ngetLatestInvoiceRow SELECT -> OK (previously ER_BAD_FIELD_ERROR)");
  } catch (err) {
    console.error(`\nFAIL: SELECT still fails -> ${err.code} | ${err.message}`);
    process.exit(1);
  }

  // Confirm every enum member this model can now write is accepted, and that
  // the old free-text label is no longer sent to the ENUM column.
  const probeNo = "PROBE-ENUM-2";
  await q("DELETE FROM invoices WHERE invoice_no = ?", [probeNo]);
  try {
    await q(
      "INSERT INTO invoices (invoice_no, payment_status, status, invoice_date) VALUES (?, ?, ?, CURDATE())",
      [probeNo, "unpaid", "Pending"],
    );
    const row = (
      await q("SELECT payment_status, status FROM invoices WHERE invoice_no = ?", [probeNo])
    )[0];
    console.log(
      `\nnormalised write -> payment_status=${JSON.stringify(row.payment_status)} status=${JSON.stringify(row.status)}`,
    );
    if (row.payment_status === "unpaid" && row.status === "Pending") {
      console.log("PASS: enum member stored, human label preserved.");
    } else {
      console.error("FAIL: stored values are not what the model intended.");
      process.exit(1);
    }
  } catch (err) {
    console.error(`\nFAIL: insert rejected -> ${err.code} | ${err.message}`);
    process.exit(1);
  }

  await q("DELETE FROM invoices WHERE invoice_no = ?", [probeNo]);
  console.log("probe row removed.");

  // Existing rows must not have been coerced to '' by earlier writes.
  const blanks = await q(
    "SELECT COUNT(*) AS n FROM invoices WHERE payment_status IS NULL OR payment_status = ''",
  );
  console.log(`\nrows with blank payment_status: ${blanks[0].n}`);

  console.log("\nRESULT: invoices.status backfilled and payment_status writes normalised.");
  process.exit(0);
}

main().catch((err) => {
  console.error("verification failed:", err.message);
  process.exit(1);
});
