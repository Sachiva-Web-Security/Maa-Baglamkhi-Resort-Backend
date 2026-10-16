const db = require("../config/db");

// Guest names live in guest_profiles (via booking_guests) and/or
// booking_rooms.guest_name in the v4 schema — never on a `guests` table.
const GUEST_NAME_SQL = `COALESCE(
  NULLIF((
    SELECT TRIM(CONCAT(COALESCE(gp.first_name, ''), ' ', COALESCE(gp.last_name, '')))
    FROM booking_guests bg
    LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
    WHERE bg.booking_id = b.id
    ORDER BY bg.is_primary DESC, bg.id ASC
    LIMIT 1
  ), ''),
  NULLIF((
    SELECT br.guest_name FROM booking_rooms br
    WHERE br.booking_id = b.id AND NULLIF(TRIM(br.guest_name), '') IS NOT NULL
    ORDER BY br.id ASC LIMIT 1
  ), ''),
  ''
)`;

const GUEST_PHONE_SQL = `(
  SELECT gp.phone FROM booking_guests bg
  LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
  WHERE bg.booking_id = b.id
  ORDER BY bg.is_primary DESC, bg.id ASC
  LIMIT 1
)`;

const GUEST_EMAIL_SQL = `(
  SELECT gp.email FROM booking_guests bg
  LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
  WHERE bg.booking_id = b.id
  ORDER BY bg.is_primary DESC, bg.id ASC
  LIMIT 1
)`;

const loadProfileForMobile = async (mobile) => {
  const [bookings] = await db.query(
    `SELECT
       b.id           AS bookingId,
       b.booking_code AS bookingCode,
       b.check_in,
       b.check_out,
       b.status AS booking_status,
       COALESCE(pay.paidAmount, 0)                      AS paidAmount,
       0                                                AS discountAmount,
       COALESCE(pay.refundAmount, 0)                    AS refundAmount,
       COALESCE(rms.totalAmount, 0)                     AS totalAmount,
       (
         COALESCE(rms.totalAmount, 0) -
         (COALESCE(pay.paidAmount, 0) - COALESCE(pay.refundAmount, 0))
       )                                                AS remainingAmount,
       rms.rooms
     FROM bookings b
     LEFT JOIN (
       SELECT booking_id,
              SUM(CASE WHEN payment_type = 'refund' THEN 0 ELSE amount END) AS paidAmount,
              SUM(CASE WHEN payment_type = 'refund' THEN amount ELSE 0 END) AS refundAmount
       FROM payments WHERE status = 'completed' GROUP BY booking_id
     ) pay ON pay.booking_id = b.id
     LEFT JOIN (
       SELECT br.booking_id,
              SUM(br.total) AS totalAmount,
              GROUP_CONCAT(DISTINCT r.room_number ORDER BY r.room_number SEPARATOR ', ') AS rooms
       FROM booking_rooms br
       LEFT JOIN rooms r ON r.id = br.room_id
       GROUP BY br.booking_id
     ) rms ON rms.booking_id = b.id
     WHERE b.id IN (
       SELECT bg.booking_id FROM booking_guests bg
       LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
       WHERE gp.phone = ?
     )
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
        `SELECT b.id, b.status, b.check_in, b.check_out,
                ${GUEST_NAME_SQL}   AS guest_name,
                ${GUEST_PHONE_SQL}  AS mobile,
                ${GUEST_EMAIL_SQL}  AS guest_email
         FROM bookings b
         WHERE b.id = ?
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
      `SELECT b.id, b.status, b.check_in, b.check_out,
              ${GUEST_NAME_SQL}   AS guest_name,
              ${GUEST_PHONE_SQL}  AS mobile,
              ${GUEST_EMAIL_SQL}  AS guest_email
       FROM bookings b
       WHERE ${GUEST_PHONE_SQL} LIKE ? OR LOWER(${GUEST_NAME_SQL}) LIKE LOWER(?)
       ORDER BY b.id DESC
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
      `SELECT b.id, b.status, b.check_in, b.check_out,
              ${GUEST_NAME_SQL}   AS guest_name,
              ${GUEST_PHONE_SQL}  AS mobile,
              ${GUEST_EMAIL_SQL}  AS guest_email
       FROM bookings b
       WHERE ${GUEST_PHONE_SQL} LIKE ? OR LOWER(${GUEST_NAME_SQL}) LIKE LOWER(?)
       ORDER BY b.id DESC
       LIMIT 20`,
      [`%${query}%`, `%${query}%`],
    );

    res.json(rows || []);
  } catch (err) {
    console.error("[guestProfile] searchList error:", err);
    res.status(500).json({ error: "Failed to search guests" });
  }
};
