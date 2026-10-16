const db = require("../config/db");
const {
  round2,
  readFolioRowsForBooking,
  pickFolioTable,
  sumFolioEntries,
  readRoomRent,
  getAdvancePaid,
  computeNetAmount,
  GST_RATE,
} = require("../utils/folioTotals");

const ensureSchema = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS hotel_folio_entries (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      booking_id  BIGINT UNSIGNED NOT NULL,
      entry_date  DATE NOT NULL,
      entry_type  ENUM(
                    'Room Charge','Extra Charge',
                    'Discount','Payment','Refund','Adjustment'
                  ) NOT NULL DEFAULT 'Extra Charge',
      category    VARCHAR(100) DEFAULT 'Miscellaneous',
      description VARCHAR(255) NOT NULL,
      amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_by  VARCHAR(100) DEFAULT 'Front Desk',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);
};

// ─── GET all entries for a booking ────────────────────────────────────────────
exports.getByBooking = async (req, res) => {
  const bookingId = req.params.bookingId;

  if (!bookingId || isNaN(Number(bookingId))) {
    return res.status(400).json({ error: "Valid bookingId required" });
  }

  try {
    await ensureSchema();
    const [entries] = await db.query(
      `SELECT * FROM hotel_folio_entries
       WHERE booking_id = ?
       ORDER BY entry_date ASC, id ASC`,
      [Number(bookingId)],
    );
    res.json(entries);
  } catch (err) {
    console.error("[folio] getByBooking error:", err);
    res.status(500).json({ error: "Failed to fetch folio entries" });
  }
};

// ─── POST — add a new charge / payment / discount line ───────────────────────
exports.addEntry = async (req, res) => {
  const bookingId = req.params.bookingId;

  if (!bookingId || isNaN(Number(bookingId))) {
    return res.status(400).json({ error: "Valid bookingId required" });
  }

  const {
    entry_date,
    entry_type = "Extra Charge",
    category = "Miscellaneous",
    description,
    amount,
    created_by = "Front Desk",
  } = req.body;

  if (!description || amount === undefined || amount === null || amount === "") {
    return res
      .status(400)
      .json({ error: "description and amount are required" });
  }

  if (isNaN(Number(amount)) || Number(amount) < 0) {
    return res.status(400).json({ error: "amount must be a non-negative number" });
  }

  try {
    await ensureSchema();

    if (!bookingId || !description || amount === undefined) {
      throw new Error("booking_id, description, and amount are required");
    }

    const [result] = await db.query(
      `INSERT INTO hotel_folio_entries
         (booking_id, entry_date, entry_type, category, description, amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(bookingId),
        entry_date || new Date().toISOString().slice(0, 10),
        entry_type,
        category,
        description,
        Number(amount),
        created_by,
      ],
    );

    res.status(201).json({ message: "Folio entry added", id: result.insertId, booking_id: Number(bookingId), entry_type, amount: Number(amount) });
  } catch (err) {
    console.error("[folio] addEntry error:", err);
    res.status(500).json({ error: err.message || "Failed to add folio entry" });
  }
};

// ─── DELETE a single folio entry ─────────────────────────────────────────────
exports.deleteEntry = async (req, res) => {
  const entryId = req.params.entryId;

  if (!entryId || isNaN(Number(entryId))) {
    return res.status(400).json({ error: "Valid entryId required" });
  }

  try {
    await ensureSchema();
    await db.query("DELETE FROM hotel_folio_entries WHERE id = ?", [Number(entryId)]);
    res.json({ message: "Folio entry deleted" });
  } catch (err) {
    console.error("[folio] deleteEntry error:", err);
    res.status(500).json({ error: "Failed to delete folio entry" });
  }
};

// ─── GET totals summary for a booking ────────────────────────────────────────
//
// All money maths lives in ../utils/folioTotals so the folio and the generated
// invoice share one definition of the sign convention. `db` is still imported
// above because the sibling endpoints build their own SQL.
exports.getTotals = async (req, res) => {
  const bookingId = req.params.bookingId;

  if (!bookingId || isNaN(Number(bookingId))) {
    return res.status(400).json({ error: "Valid bookingId required" });
  }

  try {
    await ensureSchema();
    const bookingIdNum = Number(bookingId);

    // readFolioRowsForBooking picks the folio table that actually holds rows for
    // this booking, instead of trusting folio_entries to fall back — the old
    // "table exists, so never fall back" path dropped the whole ledger when
    // folio_entries existed but was empty. It resolves to the ROW ARRAY
    // directly (or [] when there is no ledger) — NOT an object wrapper.
    const folioRows = (await readFolioRowsForBooking(bookingIdNum)) || [];
    const folioTable = await pickFolioTable(bookingIdNum);
    const buckets = sumFolioEntries(folioRows);

    // Room rent comes from booking_rooms and lives OUTSIDE the folio ledger. It
    // must be added to charges, not skipped — omitting it is what made the UI
    // show Total Charges ₹1,900 against a Net Balance of ₹2,000.
    const roomRent = await readRoomRent(bookingIdNum);
    const advance = await getAdvancePaid(bookingIdNum);

    const charges   = round2(buckets.charges + roomRent);
    const discounts = round2(buckets.discounts);
    const refunds   = round2(buckets.refunds);
    const payments  = round2(buckets.payments + advance);

    // GST on the charges. The invoice has always applied this (subtotal *
    // GST_RATE), so the folio applies it too — otherwise the folio net and the
    // invoice total can never reconcile. Tax is added here and subtracted as part
    // of netAmount in computeNetAmount.
    const tax = round2(charges * GST_RATE);

    // netAmount = charges + tax − discounts − refunds − payments.
    // Refunds SUBTRACT: a refund reverses money the resort had already counted
    // as received, so it lowers what the guest still owes.
    const { netAmount } = computeNetAmount({
      charges,
      discounts,
      refunds,
      payments,
      tax,
    });

    res.json({
      bookingId: bookingIdNum,
      folioTable,
      charges,
      tax,
      discounts,
      refunds,
      payments,
      roomRent,
      netAmount,
      // Alias kept for the existing Guest Folio UI, which reads netBalance.
      netBalance: netAmount,
      status: netAmount > 0 ? "payable" : netAmount < 0 ? "refundable" : "settled",
    });
  } catch (err) {
    console.error("[folio] getTotals error:", err);
    res.status(500).json({ error: "Failed to get folio totals" });
  }
};
