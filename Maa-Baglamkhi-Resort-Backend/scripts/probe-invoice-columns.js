require("dotenv").config({ quiet: true });

/**
 * Column-level schema report for the tables InvoiceModel.js reads, so the
 * v1 -> v4 column renames can be confirmed rather than guessed.
 */

const db = require("../src/config/db");

const q = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const TABLES = [
  "room_orders",
  "room_order_items",
  "folio_entries",
  "hotel_folio_entries",
  "booking_rooms",
  "payments",
  "invoices",
];

async function main() {
  for (const t of TABLES) {
    try {
      const cols = await q(`SHOW COLUMNS FROM ${t}`);
      console.log(`\n=== ${t} ===`);
      for (const c of cols) {
        console.log(`  ${c.Field.padEnd(24)} ${c.Type}`);
      }
    } catch (err) {
      console.log(`\n=== ${t} === MISSING (${err.code})`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("failed:", err.message);
  process.exit(1);
});
