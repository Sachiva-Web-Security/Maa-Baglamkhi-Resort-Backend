/**
 * guestProfileController.js
 * Guest Profile & Past Stay History — REST handler.
 *
 * Route (add to bookingRoutes.js):
 *   GET  /hotel/guest-profile?q=9876543210   → search
 *   GET  /hotel/guest-profile?q=Rahul Sharma  → search
 */

const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

// ─── Search guest by mobile number or name ────────────────────────────────────
exports.search = async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    // ── Step 1: Find the guest row (latest match) ─────────────────────────
    const guestRows = await runQuery(
      `SELECT id, guest_name, mobile, guest_email, booking_status, check_in, check_out
       FROM guests
       WHERE mobile LIKE ? OR LOWER(guest_name) LIKE LOWER(?)
       ORDER BY id DESC
       LIMIT 1`,
      [`%${query}%`, `%${query}%`],
    );

    if (!guestRows.length) {
      return res.json(null); // frontend shows "not found" state
    }

    const guest = guestRows[0];

    // ── Step 2: All bookings for this mobile number ───────────────────────
    // Using mobile as the linking key — same guest = same mobile
    const bookings = await runQuery(
      `SELECT
         g.id           AS bookingId,
         g.booking_code AS bookingCode,
         g.check_in,
         g.check_out,
         g.booking_status,
         g.arrival,
         g.departure,
         COALESCE(ap.amount, 0)                           AS paidAmount,
         COALESCE(ap.discount_amount, 0)                  AS discountAmount,
         COALESCE(ap.refund_amount, 0)                    AS refundAmount,
         COALESCE(SUM(rt.total), 0)                       AS totalAmount,
         (
           COALESCE(SUM(rt.total), 0) -
           (
             (COALESCE(ap.amount, 0) - COALESCE(ap.refund_amount, 0))
             + COALESCE(ap.discount_amount, 0)
           )
         )                                                AS remainingAmount,
         GROUP_CONCAT(
           DISTINCT rt.room_number
           ORDER BY rt.room_number
           SEPARATOR ', '
         )                                                AS rooms,
         c.company_name
       FROM guests g
       LEFT JOIN advance_payment ap ON ap.booking_id = g.id
       LEFT JOIN room_tariff rt     ON rt.booking_id = g.id
       LEFT JOIN companies c        ON c.booking_id  = g.id
       WHERE g.mobile = ?
       GROUP BY
         g.id, g.booking_code, g.check_in, g.check_out, g.booking_status,
         g.arrival, g.departure,
         ap.amount, ap.discount_amount, ap.refund_amount,
         c.company_name
       ORDER BY g.id DESC`,
      [guest.mobile],
    );

    // ── Step 3: Compute lifetime stats ───────────────────────────────────
    const stats = bookings.reduce(
      (acc, b) => {
        acc.totalStays += 1;
        acc.totalRevenue += Number(b.paidAmount || 0);

        if (b.check_in && b.check_out) {
          const nights =
            (new Date(b.check_out) - new Date(b.check_in)) / 86_400_000;
          acc.totalNights += Math.max(Math.round(nights), 0);
        }
        return acc;
      },
      { totalStays: 0, totalRevenue: 0, totalNights: 0 },
    );

    res.json({ guest, bookings, stats });
  } catch (err) {
    console.error("[guestProfile] search error:", err);
    res.status(500).json({ error: "Failed to search guest profile" });
  }
};
