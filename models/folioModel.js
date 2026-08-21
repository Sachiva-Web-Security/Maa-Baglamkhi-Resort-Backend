/**
 * folioModel.js
 * Guest folio / night audit model.
 * Manages hotel_folio_entries table.
 */

const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// ─── Schema bootstrap ──────────────────────────────────────────────────────
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

// ─── Get all folio entries for a booking ──────────────────────────────────
const getFolioByBooking = async (bookingId) => {
  await ensureSchema();
  return runQuery(
    `SELECT * FROM hotel_folio_entries
     WHERE booking_id = ?
     ORDER BY entry_date ASC, id ASC`,
    [bookingId],
  );
};

// ─── Add a folio entry ─────────────────────────────────────────────────────
const addFolioEntry = async ({
  booking_id,
  entry_date,
  entry_type = "Extra Charge",
  category = "Miscellaneous",
  description,
  amount,
  created_by = "Front Desk",
}) => {
  await ensureSchema();

  if (!booking_id || !description || amount === undefined) {
    throw new Error("booking_id, description, and amount are required");
  }

  const result = await runQuery(
    `INSERT INTO hotel_folio_entries
       (booking_id, entry_date, entry_type, category, description, amount, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      booking_id,
      entry_date || new Date().toISOString().slice(0, 10),
      entry_type,
      category,
      description,
      Number(amount),
      created_by,
    ],
  );

  return { id: result.insertId, booking_id, entry_type, amount };
};

// ─── Delete a folio entry ──────────────────────────────────────────────────
const deleteFolioEntry = async (entryId) => {
  await ensureSchema();
  await runQuery("DELETE FROM hotel_folio_entries WHERE id = ?", [entryId]);
};

// ─── Get folio balance totals for a booking ───────────────────────────────
const getFolioTotals = async (bookingId) => {
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
    [bookingId],
  );
  const t = rows[0] || {};
  const charges   = Number(t.totalCharges   || 0);
  const discounts = Number(t.totalDiscounts || 0);
  const payments  = Number(t.totalPayments  || 0);
  const refunds   = Number(t.totalRefunds   || 0);
  return {
    charges,
    discounts,
    payments,
    refunds,
    netBalance: charges - discounts - payments + refunds,
  };
};

module.exports = {
  ensureSchema,
  getFolioByBooking,
  addFolioEntry,
  deleteFolioEntry,
  getFolioTotals,
};
