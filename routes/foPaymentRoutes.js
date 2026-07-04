const express = require("express");
const router = express.Router();
const db = require("../config/db");

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

// ─── Guest Credit Ledger ────────────────────────────────────────────────────────
router.get("/guest-credit", async (req, res) => {
  try {
    const { mobile, name } = req.query;
    let sql = `
      SELECT
        g.id AS bookingId,
        g.guest_name,
        g.mobile,
        g.booking_status,
        COALESCE(SUM(rt.total), 0) AS totalAmount,
        IFNULL(a.amount, 0) AS totalPaid,
        IFNULL(a.discount_amount, 0) AS discountAmount,
        IFNULL(a.refund_amount, 0) AS refundAmount,
        (COALESCE(SUM(rt.total), 0)
          - (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0))
          - IFNULL(a.discount_amount, 0)) AS balance
      FROM guests g
      LEFT JOIN room_tariff rt ON g.id = rt.booking_id
      LEFT JOIN advance_payment a ON g.id = a.booking_id
      WHERE LOWER(IFNULL(g.booking_status, 'confirmed')) NOT IN ('checked out', 'cancelled')
      GROUP BY g.id, g.guest_name, g.mobile, g.booking_status, a.amount, a.discount_amount, a.refund_amount
      HAVING balance > 0
      ORDER BY g.id DESC
    `;

    let rows = await query(sql);

    if (mobile) {
      rows = rows.filter(
        (r) =>
          String(r.mobile || "").includes(mobile) ||
          String(r.mobile || "").replace(/\D/g, "").includes(mobile.replace(/\D/g, "")),
      );
    }
    if (name) {
      rows = rows.filter((r) =>
        String(r.guest_name || "").toLowerCase().includes(name.toLowerCase()),
      );
    }

    res.json(rows);
  } catch (error) {
    console.error("Guest credit GET failed:", error);
    res.status(500).json({ message: "Failed to load guest credits" });
  }
});

// ─── Vendor Credit Ledger ──────────────────────────────────────────────────────
router.get("/vendor-credit", async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error("Vendor credit GET failed:", error);
    res.status(500).json({ message: "Failed to load vendor credits" });
  }
});

// ─── Record Guest Payment ──────────────────────────────────────────────────────
router.post("/guest-credit/:bookingId/pay", async (req, res) => {
  try {
    const { amount, paymentMode, remarks } = req.body;
    const bookingId = req.params.bookingId;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    await query(
      `INSERT INTO advance_payment (booking_id, amount, payment_mode, remarks, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [bookingId, Number(amount), paymentMode || "Cash", remarks || ""],
    );

    res.json({ message: "Payment recorded successfully" });
  } catch (error) {
    console.error("Guest credit payment failed:", error);
    res.status(500).json({ message: "Failed to record payment" });
  }
});

// ─── OTA Bookings ─────────────────────────────────────────────────────────────
router.get("/ota-bookings/all", async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        g.id AS bookingId,
        g.booking_code AS bookingCode,
        g.guest_name,
        g.mobile,
        g.check_in,
        g.check_out,
        g.booking_status,
        COALESCE(SUM(rt.total), 0) AS totalAmount,
        IFNULL(a.amount, 0) AS paidAmount,
        COALESCE(px.rooms, '') AS rooms
      FROM guests g
      LEFT JOIN room_tariff rt ON g.id = rt.booking_id
      LEFT JOIN advance_payment a ON g.id = a.booking_id
      LEFT JOIN (
        SELECT booking_id,
               GROUP_CONCAT(DISTINCT CAST(room_number AS CHAR) ORDER BY room_number SEPARATOR ', ') AS rooms
        FROM pax
        WHERE NULLIF(TRIM(CAST(room_number AS CHAR)), '') IS NOT NULL
        GROUP BY booking_id
      ) px ON g.id = px.booking_id
      WHERE LOWER(IFNULL(g.booking_status, 'confirmed')) NOT IN ('checked out', 'cancelled')
      GROUP BY g.id, g.booking_code, g.guest_name, g.mobile, g.check_in,
               g.check_out, g.booking_status, px.rooms
      ORDER BY g.id DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("OTA bookings GET failed:", error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// ─── Acknowledge OTA Booking ───────────────────────────────────────────────────
router.post("/ota-bookings/:bookingId/acknowledge", async (req, res) => {
  try {
    const { bookingId } = req.params;
    await query(
      "UPDATE guests SET acknowledged_at = NOW() WHERE id = ?",
      [bookingId],
    );
    res.json({ message: "Booking acknowledged" });
  } catch (error) {
    console.error("OTA acknowledge failed:", error);
    res.status(500).json({ message: "Failed to acknowledge booking" });
  }
});

// ─── Stop / Open Rooms ─────────────────────────────────────────────────────────
router.get("/stop-open-rooms", async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        hri.id,
        hri.room_number,
        hrc.name AS categoryName,
        COALESCE(hri.status, 'Available') AS operationalStatus,
        IFNULL(hri.block_reason, '') AS blockReason,
        IFNULL(hri.block_from, '') AS blockFrom,
        IFNULL(hri.block_to, '') AS blockTo,
        IFNULL(hri.block_notes, '') AS blockNotes
      FROM hotel_room_inventory hri
      LEFT JOIN hotel_room_categories hrc ON hri.category_id = hrc.id
      ORDER BY CAST(hri.room_number AS UNSIGNED)
    `);
    res.json(rows);
  } catch (error) {
    console.error("Stop/open rooms GET failed:", error);
    res.status(500).json({ message: "Failed to load room status" });
  }
});

router.put("/stop-open-rooms/:roomNumber", async (req, res) => {
  try {
    const { roomNumber } = req.params;
    const { status, blockReason, blockFrom, blockTo, blockNotes } = req.body;

    await query(
      `UPDATE hotel_room_inventory
       SET status = ?, block_reason = ?, block_from = ?, block_to = ?, block_notes = ?
       WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)`,
      [
        status || "Available",
        blockReason || null,
        blockFrom || null,
        blockTo || null,
        blockNotes || null,
        roomNumber,
      ],
    );

    res.json({ message: "Room status updated" });
  } catch (error) {
    console.error("Stop/open room update failed:", error);
    res.status(500).json({ message: "Failed to update room" });
  }
});

module.exports = router;
