require("dotenv").config({ quiet: true });

/**
 * Which tables does InvoiceModel.js actually query, and do they exist?
 *
 * The auto-confirm log used to say "Unknown column 'status' in 'invoices'".
 * After backfilling that column a DIFFERENT error surfaced:
 * "Table 'resort_management.guests' doesn't exist". This enumerates every table
 * the model references and reports existence, to show how far its SQL has
 * drifted from the live schema.
 */

const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

const q = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

async function main() {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "models", "InvoiceModel.js"), "utf8");
  const tables = new Set();
  for (const m of src.matchAll(/(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)/gi)) {
    tables.add(m[1].toLowerCase());
  }

  const live = new Set();
  const rows = await q("SHOW TABLES");
  for (const r of rows) live.add(String(Object.values(r)[0]).toLowerCase());

  const sorted = [...tables].sort();
  const missing = [];
  console.log(`InvoiceModel.js references ${sorted.length} tables:\n`);
  for (const t of sorted) {
    const ok = live.has(t);
    if (!ok) missing.push(t);
    console.log(`  ${t.padEnd(24)} ${ok ? "exists" : "MISSING"}`);
  }

  console.log(`\n${missing.length} missing: ${missing.join(", ") || "none"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("failed:", err.message);
  process.exit(1);
});
