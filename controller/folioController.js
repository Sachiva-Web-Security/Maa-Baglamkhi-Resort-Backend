const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_folio_entries (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      booking_id  INT NOT NULL,
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
      FOREIGN KEY (booking_id) REFERENCES guests(id) ON DELETE CASCADE
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
    const entries = await runQuery(
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

    const result = await runQuery(
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
    await runQuery("DELETE FROM hotel_folio_entries WHERE id = ?", [Number(entryId)]);
    res.json({ message: "Folio entry deleted" });
  } catch (err) {
    console.error("[folio] deleteEntry error:", err);
    res.status(500).json({ error: "Failed to delete folio entry" });
  }
};

// ─── GET totals summary for a booking ────────────────────────────────────────
exports.getTotals = async (req, res) => {
  const bookingId = req.params.bookingId;

  if (!bookingId || isNaN(Number(bookingId))) {
    return res.status(400).json({ error: "Valid bookingId required" });
  }

  try {
    await ensureSchema();
    const rows = await runQuery(
      `SELECT
         SUM(CASE WHEN entry_type IN ('Room Charge','Extra Charge','Adjustment')
                  THEN amount ELSE 0 END)  AS totalCharges,
         SUM(CASE WHEN entry_type = 'Discount' THEN amount ELSE 0 END) AS totalDiscounts,
         SUM(CASE WHEN entry_type = 'Payment'  THEN amount ELSE 0 END) AS totalPayments,
         SUM(CASE WHEN entry_type = 'Refund'   THEN amount ELSE 0 END) AS totalRefunds
       FROM hotel_folio_entries
       WHERE booking_id = ?`,
      [Number(bookingId)],
    );
    const t = rows[0] || {};
    const charges   = Number(t.totalCharges   || 0);
    const discounts = Number(t.totalDiscounts || 0);
    const payments  = Number(t.totalPayments  || 0);
    const refunds   = Number(t.totalRefunds   || 0);
    res.json({
      charges,
      discounts,
      payments,
      refunds,
      netBalance: charges - discounts - payments + refunds,
    });
  } catch (err) {
    console.error("[folio] getTotals error:", err);
    res.status(500).json({ error: "Failed to get folio totals" });
  }
};
