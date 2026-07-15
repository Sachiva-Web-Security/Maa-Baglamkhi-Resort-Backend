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

    const [result] = await query(
      "UPDATE guests SET mobile = ? WHERE id = ?",
      [mobile, bookingId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ message: "Guest phone number updated successfully", mobile });
  } catch (err) {
    console.error("updateGuestPhone error:", err);
    res.status(500).json({ error: err.message || "Failed to update phone number" });
  }
};