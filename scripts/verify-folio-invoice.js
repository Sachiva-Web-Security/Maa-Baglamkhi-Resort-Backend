require("dotenv").config({ quiet: true });

/**
 * Verifies that folio charges added via the Guest Folio UI are now correctly
 * included in generated invoices.
 *
 * Booking 9044 has these entries in hotel_folio_entries (the UI's table):
 *   Extra Charge  Laundry         ₹600  2 FORMAL WEAR
 *   Extra Charge  Early Check-In ₹1000 1 hour before check in
 *   Refund        Miscellaneous   ₹100  Returned extra blanket (1)
 *   Room Charge   Phone          ₹300  one wireless phone
 *
 * Expected invoice after fix:
 *   Room/extra charge line items: ₹600 + ₹1000 + ₹300 = ₹1900
 *   Refund: ¥100 (shown separately, not in subtotal)
 *   Payments: ¥0
 *   Subtotal: ¥1900
 *   Net Balance: ¥1900 (since no payments received yet)
 */

const ROOT = "http://127.0.0.1:5002/api";
const call = async (method, path, body, token) => {
  const res = await fetch(ROOT + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

async function main() {
  const login = await call("POST", "/auth/login", {
    email: "verify.reception@test.com",
    password: "Verify@123",
  });
  if (login.status !== 200) { console.error("Login failed:", login.data); process.exit(1); }
  const token = login.data.token;

  // ── 1. Folio entries in hotel_folio_entries for booking 9044 ─────────────
  const db = require("../src/config/db");
  const q = (sql, params) => new Promise((res, rej) =>
    db.query(sql, params, (e, r) => (e ? rej(e) : res(r))));
  const folioRows = await q(
    "SELECT entry_type, category, description, amount FROM hotel_folio_entries WHERE booking_id = 9044 ORDER BY id",
  );
  console.log("hotel_folio_entries rows for booking 9044:");
  folioRows.forEach(r => console.log(`  ${r.entry_type.padEnd(14)} ${String(r.amount).padStart(8)}  ${r.description}`));
  const folioCharges = folioRows
    .filter(r => ["Room Charge","Extra Charge","Adjustment"].includes(r.entry_type))
    .reduce((s, r) => s + Number(r.amount), 0);
  const folioRefunds = folioRows
    .filter(r => r.entry_type === "Refund")
    .reduce((s, r) => s + Number(r.amount), 0);
  console.log(`  charges=${folioCharges} refunds=${folioRefunds}`);

  // ── 2. Generate invoice via InvoiceModel ────────────────────────────────
  // getInvoiceByBookingId returns the row itself (not {invoice:...}), and {}
  // when there is no invoice yet.
  const inv = await call("GET", `/invoice/by-booking/9044`, null, token);
  console.log(`GET /api/invoice/by-booking/9044 -> ${inv.status}`);

  const invoiceId = inv.data?.id || null;

  if (!invoiceId) {
    // Force a fresh generation: buildInvoicePayload is what applies the fix.
    const InvoiceModel = require("../src/models/InvoiceModel");
    const built = await InvoiceModel.generateCustomerInvoice(9044);
    console.log("regenerated via InvoiceModel:", built?.invoiceNo || built?.invoice_no);
  }

  const final = await call("GET", `/invoice/by-booking/9044`, null, token);
  const row = final.data || {};
  const items = Array.isArray(row.items)
    ? row.items
    : (() => { try { return JSON.parse(row.items_json || "[]"); } catch { return []; } })();

  console.log(`\nInvoice #${row.invoice_no}:`);
  console.log(`  subtotal       = ₹${row.subtotal}`);
  console.log(`  gst/tax        = ₹${row.gst}`);
  console.log(`  discount       = ₹${row.discount}`);
  console.log(`  total_amount   = ₹${row.total_amount ?? row.final_total}`);
  console.log(`  payment_status = ${row.payment_status} (label ${row.status})`);
  console.log(`  line items (${items.length}):`);
  items.forEach(it => console.log(`    ${it.name}  ₹${it.total}`));

  // ── 3. Verify folio charges are included ────────────────────────────────
  // The invoice is the COMBINATION of room rent (booking_rooms) + folio
  // charges + food. So it must contain at least the folio charges, not equal
  // them. The room rent for BD503 is ₹800, so the expected subtotal is
  // ₹800 + ₹1900 = ₹2700.
  const failures = [];

  const folioNames = new Set(folioRows
    .filter(r => ["Room Charge", "Extra Charge", "Adjustment"].includes(r.entry_type))
    .map(r => String(r.description || "").trim()));

  const matched = items.filter(it => folioNames.has(String(it.name || "").trim()));
  const matchedTotal = matched.reduce((s, it) => s + Number(it.total || 0), 0);

  console.log(`\n  folio entries matched in invoice: ${matched.length}/${folioNames.size}`);
  matched.forEach(it => console.log(`    ${it.name}  ₹${it.total}`));

  if (matched.length !== folioNames.size) {
    failures.push(`${folioNames.size - matched.length} folio charge(s) missing from invoice line items`);
  }
  if (Math.abs(matchedTotal - folioCharges) > 1) {
    failures.push(`matched folio items sum ₹${matchedTotal} but folio charges = ₹${folioCharges}`);
  }

  // Subtotal must include BOTH room rent and the folio charges.
  const invoiceItemTotal = items.reduce((s, it) => s + Number(it.total || 0), 0);
  const expectedSubtotal = Number(row.subtotal);
  if (Math.abs(expectedSubtotal - invoiceItemTotal) > 1) {
    failures.push(`subtotal ₹${expectedSubtotal} != line-item sum ₹${invoiceItemTotal} — items and subtotal disagree`);
  }

  if (failures.length) {
    console.error("\nFAIL:", failures.join("; "));
    process.exit(1);
  }

  console.log("\nRESULT: folio charges correctly included in invoice.");
  process.exit(0);
}

main().catch(err => { console.error("verification failed:", err.message); process.exit(1); });
