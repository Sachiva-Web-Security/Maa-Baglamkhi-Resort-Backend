/*
 * CANONICAL FOLIO MONEY CONTRACT — single source of truth for folio / invoice totals.
 *
 * Both the Guest Folio page and the generated invoice MUST derive their numbers
 * through this module. It used to be duplicated in folioController.js and
 * InvoiceModel.js, and the two copies drifted apart (one added refunds, the
 * other added a tax line the folio has no business showing).
 *
 * Sign convention: every amount is a NON-NEGATIVE magnitude. The sign is implied
 * by which bucket the entry lands in. Never store or sum a negative amount —
 * `Math.abs()` is applied before every accumulation.
 *
 * Buckets
 *   charges   money the resort is owed (room charge / extra charge / adjustment)
 *             → ADDITIVE
 *   discounts money waived                                   → SUBTRACTS
 *   refunds   money already sent BACK to the guest          → SUBTRACTS
 *   payments  money already received                        → SUBTRACTS
 *
 * Formula (apply exactly, in this order)
 *   totalCharges   = charges
 *   totalDiscount  = discounts
 *   totalRefunds   = refunds
 *   totalPayments  = payments
 *   netAmount      = round2(totalCharges - totalDiscount - totalRefunds - totalPayments)
 *
 *   netAmount >  0 → guest still owes        (PAYABLE)
 *   netAmount == 0 → settled
 *   netAmount <  0 → resort owes the guest   (REFUNDABLE / credit)
 *
 * Invoice-specific
 *   subtotal = round2(sum of charge line-item totals)
 *   tax      = round2(subtotal * GST_RATE)
 *   grossDue = round2(subtotal + tax - totalDiscount)
 *   total    = round2(grossDue - totalRefunds - totalPayments)
 *   // `total` MUST equal the folio's `netAmount` for the same booking.
 *
 * Hard rules
 *   1. round2() every aggregate. MySQL returns DECIMAL as a STRING
 *      ("1900.00") and raw float addition drifts. Never sum raw values.
 *   2. Both folio tables are supported and their enum spellings normalised:
 *        hotel_folio_entries  'Room Charge' | 'Extra Charge' | 'Adjustment'
 *                             | 'Discount' | 'Payment' | 'Refund'
 *        folio_entries        'room_charge' | 'extra_charge' | 'adjustment'
 *                             | 'discount' | 'payment' | 'refund'
 *      — via canonicalFolioType(). 'Room Charge' and 'room_charge' are the
 *      same bucket.
 *   3. Refunds SUBTRACT. A previous implementation added them — that is the bug
 *      this module exists to stop recurring.
 *   4. The folio UI and the generated invoice MUST produce the same netAmount.
 *   5. Every bucket must be DISPLAYED so the user can see what was deducted and
 *      what remains.
 *
 * Public API
 *   round2(value)                                  money rounding, float-drift safe
 *   canonicalFolioType(raw)                        normalises entry_type spelling
 *   bucketForType(raw)                             -> charges|discounts|refunds|payments|null
 *   sumFolioEntries(rows)                          -> { charges, discounts, refunds, payments }
 *   computeNetAmount({ charges, discounts, refunds, payments })
 *                                                 -> { totalCharges, totalDiscount, totalRefunds,
 *                                                     totalPayments, netAmount }
 *   pickFolioTable(bookingId)                      -> 'hotel_folio_entries'|'folio_entries'|null
 *   readFolioRowsForBooking(bookingId)             -> normalised { entry_type, amount, ... }[]
 *   readRoomRent(bookingId)                        -> rounded room rent total (helper)
 *   computeInvoiceTotals({ subtotal, ... })        -> invoice totals (helper)
 */

const db = require("../config/db");

const GST_RATE = 0.05;
// The ONE definition of the GST rate. Exported so folioController and
// InvoiceModel both tax at exactly this rate — two copies of this constant is
// how the folio and invoice ended up disagreeing.
exports.GST_RATE = GST_RATE;

// Reading order: the UI's table first, then the legacy v4 table.
const FOLIO_TABLES = ["hotel_folio_entries", "folio_entries"];

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// NOTE: `db` is a mysql2 promise pool wrapped in a callback shim (src/config/db.js).
// With a callback it resolves the ROW ARRAY; destructuring it would read [rows, fields].
// So these helpers must NOT use `const [rows] = await ...`.

const isNumberish = (value) => value !== null && value !== undefined && String(value).trim() !== "";

const parseAmount = (value) => {
  if (!isNumberish(value)) return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : 0;
};

// Math.round over half-way values is biased toward +Infinity, so 1.005 -> 1.01
// while -1.005 -> -1.01. Rounding the paise *magnitude* first keeps the result
// symmetric. Number.EPSILON absorbs the classic 1900.0000000000002-style drift
// that accumulates when MySQL DECIMAL strings are added together as floats.
exports.round2 = (value) => {
  if (!isNumberish(value)) return 0;
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100 + Number.EPSILON) / 100 * Math.sign(n);
};

// 'Room Charge' | 'room_charge' | 'Room_Charge' | "room - charge" -> 'room_charge'
exports.canonicalFolioType = (raw) =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Canonical type -> bucket name. Anything unmapped returns null and is NOT summed
// (e.g. folio_entries' 'food' / 'beverage' / 'service', which are billed through
// the room_orders path instead).
const BUCKET_BY_TYPE = {
  room_charge: "charges",
  extra_charge: "charges",
  adjustment: "charges",
  discount: "discounts",
  refund: "refunds",
  payment: "payments",
};

exports.bucketForType = (raw) => BUCKET_BY_TYPE[exports.canonicalFolioType(raw)] || null;

// Sums rows shaped { entry_type, amount }. MySQL DECIMAL arrives as a string
// ("1900.00"), which is fine here — parseAmount handles strings, numbers and the
// empty string alike, and never throws.
exports.sumFolioEntries = (rows) => {
  const totals = { charges: 0, discounts: 0, refunds: 0, payments: 0 };
  if (!Array.isArray(rows)) return totals;

  rows.forEach((row) => {
    const bucket = exports.bucketForType(row && row.entry_type);
    if (!bucket) return;
    totals[bucket] += parseAmount(row.amount);
  });

  return {
    charges: exports.round2(totals.charges),
    discounts: exports.round2(totals.discounts),
    refunds: exports.round2(totals.refunds),
    payments: exports.round2(totals.payments),
  };
};

// netAmount = charges − discounts − refunds − payments − tax
//
// `tax` is GST on the charges. It is included here (rather than being an
// invoice-only concept) because the Guest Folio page and the generated invoice
// MUST agree: the invoice has always added `subtotal * GST_RATE`, so a folio
// without a tax line could never reconcile with it. Pass tax: 0 to omit.
exports.computeNetAmount = ({
  charges,
  discounts,
  refunds,
  payments,
  tax = 0,
}) => {
  const totalCharges = exports.round2(charges);
  const totalDiscount = exports.round2(discounts);
  const totalRefunds = exports.round2(refunds);
  const totalPayments = exports.round2(payments);
  const totalTax = exports.round2(tax);

  return {
    totalCharges,
    totalTax,
    totalDiscount,
    totalRefunds,
    totalPayments,
    // Refunds SUBTRACT: money returned to the guest reverses a previously
    // counted payment or charge, so it lowers what the guest still owes.
    netAmount: exports.round2(
      totalCharges + totalTax - totalDiscount - totalRefunds - totalPayments,
    ),
  };
};

const tableExists = async (tableName) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

// Returns the one folio table that actually holds this booking's ledger:
// hotel_folio_entries if it has rows, else folio_entries if it has rows, else
// null. Never falls through on table absence alone — an *existing but empty*
// table must not win the pick, or a split-across-both booking loses a side.
exports.pickFolioTable = async (bookingId) => {
  if (!isNumberish(bookingId)) return null;
  const id = Number(bookingId);

  const counts = [];
  for (const table of FOLIO_TABLES) {
    if (!(await tableExists(table))) continue;
    const rows = await runQuery(
      `SELECT COUNT(*) AS n FROM ${table} WHERE booking_id = ?`,
      [id],
    );
    counts.push({ table, n: Number((rows && rows[0] && rows[0].n) || 0) });
  }

  const withRows = counts.find((entry) => entry.n > 0);
  return withRows ? withRows.table : null;
};

// Reads the chosen table's rows for a booking and normalises every entry_type
// through canonicalFolioType() into a leading `entry_type` field (canonical
// value) plus `entry_type_raw` (as stored). Returns [] when neither table has
// rows for this booking — it does not throw.
exports.readFolioRowsForBooking = async (bookingId) => {
  const table = await exports.pickFolioTable(bookingId);
  if (!table) return [];

  const rows = await runQuery(
    `SELECT id, entry_date, entry_type, category, description, amount
       FROM ${table}
      WHERE booking_id = ?
      ORDER BY entry_date ASC, id ASC`,
    [Number(bookingId)],
  );

  return (rows || []).map((row) => {
    const canonical = exports.canonicalFolioType(row.entry_type);
    return { ...row, entry_type_raw: row.entry_type, entry_type: canonical };
  });
};

// Room rent is billed from booking_rooms, not the folio ledger. Included so the
// contract's "charges = room rent + folio entries" half of the formula has one
// implementation too; callers that want folio-only totals omit this.
//
// Computes from room_charge × nights, NOT from booking_rooms.total. That column
// was written by BookingFlow.rowTotal as price × nights × quantity × (1 + gst%),
// i.e. with GST baked in — a ₹800/night room stored ₹840, and bundled rows held
// far more again. If room rent were read from `total` it would be taxed twice:
// once here, and once more by buildInvoicePayload's `subtotal * GST_RATE`.
// (rowTotal has been corrected to return the pre-tax base, so only legacy rows
// are affected by the pollution.)
exports.readRoomRent = async (bookingId) => {
  if (!isNumberish(bookingId)) return 0;
  if (!(await tableExists("booking_rooms"))) return 0;

  const rows = await runQuery(
    `SELECT COALESCE(SUM(COALESCE(NULLIF(room_charge, 0), rate_per_night)
                        * COALESCE(NULLIF(nights, 0), 1)), 0) AS rent
       FROM booking_rooms
      WHERE booking_id = ?`,
    [Number(bookingId)],
  );
  return exports.round2((rows && rows[0] && rows[0].rent) || 0);
};

// Money already collected against this booking outside the folio ledger: the
// advance captured in the payments table. Rows with payment_type = 'refund'
// are money going OUT, so they are excluded here rather than netted — they
// belong to the `refunds` bucket, which the contract already subtracts.
exports.getAdvancePaid = async (bookingId) => {
  if (!isNumberish(bookingId)) return 0;
  if (!(await tableExists("payments"))) return 0;

  const rows = await runQuery(
    `SELECT COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN 0 ELSE amount END), 0) AS paid
       FROM (
         SELECT MAX(id) AS last_id FROM payments
         WHERE booking_id = ? AND bill_id IS NOT NULL
         GROUP BY bill_id
         UNION ALL
         SELECT id FROM payments WHERE booking_id = ? AND bill_id IS NULL
       ) dedup
       JOIN payments ON payments.id = dedup.last_id`,
    [Number(bookingId), Number(bookingId)],
  );
  return exports.round2((rows && rows[0] && rows[0].paid) || 0);
};

// Invoice variant of the contract. `total` must equal the folio's netAmount.
exports.computeInvoiceTotals = ({
  subtotal,
  discount,
  refunds,
  payments,
  taxRate = GST_RATE,
}) => {
  const s = exports.round2(subtotal);
  const tax = exports.round2(s * taxRate);
  const totalDiscount = exports.round2(discount);
  const totalRefunds = exports.round2(refunds);
  const totalPayments = exports.round2(payments);

  return {
    subtotal: s,
    tax,
    totalDiscount,
    totalRefunds,
    totalPayments,
    grossDue: exports.round2(s + tax - totalDiscount),
    total: exports.round2(s + tax - totalDiscount - totalRefunds - totalPayments),
  };
};
