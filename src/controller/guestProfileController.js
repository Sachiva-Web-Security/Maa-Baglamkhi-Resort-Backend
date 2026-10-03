const db = require("../config/db");

const loadProfileForMobile = async (mobile) => {
  const [bookings] = await db.query(
    `SELECT
       b.id           AS bookingId,
       b.booking_code AS bookingCode,
       b.check_in,
       b.check_out,
       b.status AS booking_status,
       COALESCE(ap.amount, 0)                           AS paidAmount,
       COALESCE(ap.discount_amount, 0)                  AS discountAmount,
       COALESCE(ap.refund_amount, 0)                    AS refundAmount,
       COALESCE(SUM(rt.amount), 0)                      AS totalAmount,
       (
         COALESCE(SUM(rt.amount), 0) -
         (
           (COALESCE(ap.amount, 0) - COALESCE(ap.refund_amount, 0))
           + COALESCE(ap.discount_amount, 0)
         )
       )                                                AS remainingAmount,
       GROUP_CONCAT(
         DISTINCT rt.room_number
         ORDER BY rt.room_number
         SEPARATOR ', '
       )                                                AS rooms
     FROM bookings b
     LEFT JOIN payments ap ON ap.booking_id = b.id
     LEFT JOIN room_tariff rt     ON rt.booking_id = b.id
     WHERE b.mobile = ?
     GROUP BY
       b.id, b.booking_code, b.check_in, b.check_out, b.status,
       ap.amount, ap.discount_amount, ap.refund_amount
     ORDER BY b.id DESC`,
    [mobile],
  );

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

  return { bookings, stats, latestDocument: null };
};

exports.search = async (req, res) => {
  const query = String(req.query.q || "").trim();
  const bookingId = Number(req.query.bookingId || 0);

  try {
    if (bookingId) {
      const [bookingRows] = await db.query(
        `SELECT id, guest_name, mobile, guest_email, status, check_in, check_out
         FROM bookings
         WHERE id = ?
         LIMIT 1`,
        [bookingId],
      );

      if (!bookingRows.length) {
        return res.json(null);
      }

      const guest = bookingRows[0];

      if (!guest.mobile) {
        return res.json({
          guest,
          bookings: [{ ...guest, bookingId: guest.id }],
          stats: { totalStays: 0, totalRevenue: 0, totalNights: 0 },
          documents: [],
          latestDocument: null,
        });
      }

      const profile = await loadProfileForMobile(guest.mobile);
      return res.json({ guest, ...profile });
    }

    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' or 'bookingId' is required" });
    }

    const [guestRows] = await db.query(
      `SELECT id, guest_name, mobile, guest_email, status, check_in, check_out
       FROM bookings
       WHERE mobile LIKE ? OR LOWER(guest_name) LIKE LOWER(?)
       ORDER BY id DESC
       LIMIT 1`,
      [`%${query}%`, `%${query}%`],
    );

    if (!guestRows.length) {
      return res.json(null);
    }

    const guest = guestRows[0];
    const profile = guest.mobile
      ? await loadProfileForMobile(guest.mobile)
      : { bookings: [], stats: { totalStays: 0, totalRevenue: 0, totalNights: 0 }, documents: [], latestDocument: null };

    res.json({ guest, ...profile });
  } catch (err) {
    console.error("[guestProfile] search error:", err);
    res.status(500).json({ error: "Failed to search guest profile" });
  }
};

exports.searchList = async (req, res) => {
  const query = String(req.query.q || "").trim();
  try {
    if (!query) {
      return res.json([]);
    }

    const [rows] = await db.query(
      `SELECT id, guest_name, mobile, guest_email, status, check_in, check_out
       FROM bookings
       WHERE mobile LIKE ? OR LOWER(guest_name) LIKE LOWER(?)
       ORDER BY id DESC
       LIMIT 20`,
      [`%${query}%`, `%${query}%`],
    );

    res.json(rows || []);
  } catch (err) {
    console.error("[guestProfile] searchList error:", err);
    res.status(500).json({ error: "Failed to search guests" });
  }
};
