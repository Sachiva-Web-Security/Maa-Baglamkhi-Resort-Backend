/**
 * folioController.js
 * Guest Folio / Night Audit — REST handlers.
 *
 * Routes (add to bookingRoutes.js):
 *   GET    /hotel/folio/:bookingId          → getByBooking
 *   POST   /hotel/folio/:bookingId          → addEntry
 *   DELETE /hotel/folio/entry/:entryId      → deleteEntry
 *   GET    /hotel/folio/:bookingId/totals   → getTotals
 */

const folioModel = require("../models/folioModel");

// ─── GET all entries for a booking ────────────────────────────────────────────
exports.getByBooking = async (req, res) => {
  const bookingId = req.params.bookingId;

  if (!bookingId || isNaN(Number(bookingId))) {
    return res.status(400).json({ error: "Valid bookingId required" });
  }

  try {
    const entries = await folioModel.getFolioByBooking(Number(bookingId));
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
    const result = await folioModel.addFolioEntry({
      booking_id: Number(bookingId),
      entry_date,
      entry_type,
      category,
      description,
      amount: Number(amount),
      created_by,
    });
    res.status(201).json({ message: "Folio entry added", ...result });
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
    await folioModel.deleteFolioEntry(Number(entryId));
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
    const totals = await folioModel.getFolioTotals(Number(bookingId));
    res.json(totals);
  } catch (err) {
    console.error("[folio] getTotals error:", err);
    res.status(500).json({ error: "Failed to get folio totals" });
  }
};
