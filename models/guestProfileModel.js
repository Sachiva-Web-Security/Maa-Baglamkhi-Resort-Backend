/**
 * guestProfileModel.js
 * Look up a guest by mobile or name and return all past bookings.
 */

const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

/**
 * Search guest profile by mobile number or guest name (partial match).
 * Returns the guest record + all associated bookings with payment totals.
 */
const searchGuestProfile = async (query) => {
  const q = String(query || "").trim();
  if (!q) throw new Error("Search query is required");

  // Find the guest row
  const guests = await runQuery(
    `SELECT id, guest_name, mobile, guest_email, booking_status, check_in, check_out
     FROM guests
     WHERE mobile LIKE ? OR LOWER(guest_name) LIKE LOWER(?)
     ORDER BY id DESC
     LIMIT 1`,
    [`%${q}%`, `%${q}%`],
  );

  if (!guests.length) return null;

  const guest = guests[0];

  // Get all bookings for this mobile number
  const bookings = await runQuery(
    `SELECT
       g.id           AS bookingId,
       g.booking_code AS bookingCode,
       g.check_in,
       g.check_out,
       g.booking_status,
       g.arrival,
       g.departure,
       COALESCE(ap.amount, 0)           AS paidAmount,
       COALESCE(ap.discount_amount, 0)  AS discountAmount,
       COALESCE(ap.refund_amount, 0)    AS refundAmount,
       GROUP_CONCAT(DISTINCT t.room_number ORDER BY t.room_number SEPARATOR ', ') AS rooms
     FROM guests g
     LEFT JOIN advance_payment ap ON ap.booking_id = g.id
     LEFT JOIN tariffs t ON t.booking_id = g.id
     WHERE g.mobile = ?
     GROUP BY g.id, g.booking_code, g.check_in, g.check_out,
              g.booking_status, g.arrival, g.departure,
              ap.amount, ap.discount_amount, ap.refund_amount
     ORDER BY g.id DESC`,
    [guest.mobile],
  );

  // Compute remainingAmount per booking
  const enriched = bookings.map((b) => {
    const tariffRows = null; // already aggregated above
    return {
      ...b,
      paidAmount:      Number(b.paidAmount || 0),
      discountAmount:  Number(b.discountAmount || 0),
      refundAmount:    Number(b.refundAmount || 0),
      remainingAmount: 0,  // Will need totalAmount from tariffs — left for controller
    };
  });

  return { guest, bookings: enriched };
};

module.exports = { searchGuestProfile };
