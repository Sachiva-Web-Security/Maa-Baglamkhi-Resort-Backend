require("dotenv").config({ quiet: true });

/**
 * Applies the `invoices.status` column that InvoiceModel's ensureSchema was
 * missing, then re-probes whether the free-text paymentStatus values the model
 * writes survive the live ENUM. Idempotent, and removes its probe rows.
 */

const db = require("../src/config/db");

const q = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

async function main() {
  const existing = await q("SHOW COLUMNS FROM invoices LIKE 'status'");
  if (!existing.length) {
    await q("ALTER TABLE invoices ADD COLUMN status VARCHAR(50) DEFAULT 'Pending' AFTER payment_mode");
    console.log("added invoices.status VARCHAR(50) DEFAULT 'Pending'");
  } else {
    console.log(`invoices.status already present (${existing[0].Type})`);
  }

  const probeNo = "PROBE-ENUM-1";
  await q("DELETE FROM invoices WHERE invoice_no = ?", [probeNo]);

  try {
    await q(
      "INSERT INTO invoices (invoice_no, payment_status, status, invoice_date) VALUES (?, ?, ?, CURDATE())",
      [probeNo, "Pending", "Pending"],
    );
    const row = (await q("SELECT payment_status, status FROM invoices WHERE invoice_no = ?", [probeNo]))[0];
    console.log("payment_status='Pending' accepted");
    console.log(`  stored payment_status = ${JSON.stringify(row.payment_status)}`);
    console.log(`  stored status          = ${JSON.stringify(row.status)}`);
  } catch (err) {
    console.log(`payment_status='Pending' REJECTED: ${err.code} | ${err.message}`);
  }

  await q("DELETE FROM invoices WHERE invoice_no = ?", [probeNo]);
  console.log("probe row removed");

  process.exit(0);
}

main().catch((err) => {
  console.error("probe failed:", err.message);
  process.exit(1);
});
