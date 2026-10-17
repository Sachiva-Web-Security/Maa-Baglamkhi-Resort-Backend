/**
 * GuestController extensions — admin-only guest phone update.
 *
 * Route: PUT /api/hotel/guest/phone/:bookingId
 * Body: { "mobile": "9876543210" }
 * Auth: admin only
 */

const db = require("../config/db");

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

/**
 * PUT /api/hotel/guest/phone/:bookingId
 * Admin only — updates the mobile number for a booking's guest.
 */
exports.updateGuestPhone = async (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!bookingId) {
      return res.status(400).json({ error: "Valid booking ID is required" });
    }

    const rawMobile = String(req.body?.mobile || "").trim();
    if (!rawMobile) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Sanitize to digits only
    const mobile = rawMobile.replace(/\D+/g, "");
    if (mobile.length < 10) {
      return res.status(400).json({ error: "Phone number must have at least 10 digits" });
    }

    // The legacy `guests` table is empty and has no booking_id column, so the
    // old UPDATE matched nothing and every call reported "Booking not found".
    // The v4 phone lives only on guest_profiles.phone - bookings has no mobile
    // column, and booking_guests only carries names.
    const rows = await query(
      `SELECT b.id AS booking_id,
              bg.guest_profile_id AS guest_id
       FROM bookings b
       LEFT JOIN (
         SELECT booking_id, guest_profile_id
         FROM booking_guests
         WHERE is_primary = 1
       ) bg ON bg.booking_id = b.id
       WHERE b.id = ?
       LIMIT 1`,
      [bookingId],
    );
    const booking = rows[0];

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (!booking.guest_id) {
      return res.status(404).json({ error: "Booking has no guest profile" });
    }

    const result = await query(
      "UPDATE guest_profiles SET phone = ? WHERE id = ?",
      [mobile, booking.guest_id],
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: "Guest profile not found" });
    }

    res.json({ message: "Guest phone number updated successfully", mobile });
  } catch (err) {
    console.error("updateGuestPhone error:", err);
    res.status(500).json({ error: err.message || "Failed to update phone number" });
  }
};
