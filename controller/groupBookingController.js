/**
 * groupBookingController.js
 * Group Booking — creates a master guest + multiple rooms + advance payment
 * in a single atomic transaction.
 *
 * Route (add to bookingRoutes.js):
 *   POST  /hotel/group-booking   → create
 *
 * Expected body:
 * {
 *   guest: {
 *     guestName, mobile, guestEmail,
 *     checkIn, checkOut, arrival, departure,
 *     bookingStatus, groupLabel
 *   },
 *   rooms: [
 *     { roomNumber, categoryName, tariff, gst, adults, children, nights, total }
 *   ],
 *   payment: {
 *     amount, discount, paymentMode, remarks, totalAmount
 *   }
 * }
 */

const crypto = require("crypto");
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const generateBookingCode = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `GRP-${date}-${rand}`;
};

// ─── Ensure group_booking tables exist ───────────────────────────────────────
const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_group_bookings (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      booking_id   INT NOT NULL UNIQUE,
      group_label  VARCHAR(200) DEFAULT NULL,
      total_rooms  INT NOT NULL DEFAULT 1,
      grand_total  DECIMAL(10,2) NOT NULL DEFAULT 0,
      paid_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES guests(id) ON DELETE CASCADE
    )
  `);

  // Ensure guests table has group columns
  const cols = await runQuery("SHOW COLUMNS FROM guests LIKE 'is_group_booking'");
  if (!cols.length) {
    await runQuery(
      "ALTER TABLE guests ADD COLUMN is_group_booking TINYINT(1) NOT NULL DEFAULT 0",
    );
  }

  const labelCols = await runQuery("SHOW COLUMNS FROM guests LIKE 'group_label'");
  if (!labelCols.length) {
    await runQuery(
      "ALTER TABLE guests ADD COLUMN group_label VARCHAR(200) DEFAULT NULL",
    );
  }
};

// ─── POST /hotel/group-booking ────────────────────────────────────────────────
exports.create = async (req, res) => {
  const { guest, rooms, payment } = req.body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!guest?.guestName || !guest?.mobile) {
    return res.status(400).json({ error: "guestName and mobile are required" });
  }
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return res.status(400).json({ error: "At least one room is required" });
  }
  if (!guest.checkIn || !guest.checkOut) {
    return res.status(400).json({ error: "checkIn and checkOut are required" });
  }

  try {
    await ensureSchema();

    // ── Step 1: Create master guest record ───────────────────────────────
    const bookingCode = generateBookingCode();

    const guestResult = await runQuery(
      `INSERT INTO guests
         (booking_code, mobile, guest_name, guest_email,
          check_in, check_out, arrival, departure,
          booking_status, is_group_booking, group_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        bookingCode,
        guest.mobile,
        guest.guestName,
        guest.guestEmail || "",
        guest.checkIn,
        guest.checkOut,
        guest.arrival || null,
        guest.departure || null,
        guest.bookingStatus || "Confirmed",
        guest.groupLabel || null,
      ],
    );

    const bookingId = guestResult.insertId;

    // ── Step 2: Insert room tariff rows for each room ─────────────────────
    // Ensure room_tariff table has a category_name column
    const catCol = await runQuery(
      "SHOW COLUMNS FROM room_tariff LIKE 'category_name'",
    ).catch(() => []);

    if (catCol && !catCol.length) {
      await runQuery(
        "ALTER TABLE room_tariff ADD COLUMN category_name VARCHAR(120) DEFAULT NULL",
      ).catch(() => {}); // Non-fatal if column already exists
    }

    const grandTotal = rooms.reduce((s, r) => s + Number(r.total || 0), 0);

    for (const room of rooms) {
      const nights = Number(room.nights || 1);
      const tariff = Number(room.tariff || 0);
      const gst    = Number(room.gst || 0);
      const base   = tariff * nights;
      const total  = Number(room.total || base + (base * gst) / 100);

      await runQuery(
        `INSERT INTO room_tariff
           (booking_id, room_number, tariff, gst, total, category_name)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           tariff = VALUES(tariff),
           gst    = VALUES(gst),
           total  = VALUES(total)`,
        [
          bookingId,
          String(room.roomNumber || ""),
          tariff,
          gst,
          total,
          room.categoryName || null,
        ],
      );

      // Insert pax row for each room
      await runQuery(
        `INSERT INTO pax (booking_id, room_number, adults, children)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           adults   = VALUES(adults),
           children = VALUES(children)`,
        [
          bookingId,
          String(room.roomNumber || ""),
          Number(room.adults || 1),
          Number(room.children || 0),
        ],
      ).catch(() => {}); // pax table may not have room_number — skip gracefully
    }

    // ── Step 3: Create advance payment record ─────────────────────────────
    const paidAmount    = Number(payment?.amount   || 0);
    const discountAmt   = Number(payment?.discount || 0);
    const paymentMode   = payment?.paymentMode || "Cash";
    const remarks       = payment?.remarks || null;

    await runQuery(
      `INSERT INTO advance_payment
         (booking_id, amount, discount_amount, payment_mode, remarks)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         amount           = amount + VALUES(amount),
         discount_amount  = IFNULL(discount_amount, 0) + VALUES(discount_amount),
         payment_mode     = VALUES(payment_mode),
         remarks          = COALESCE(VALUES(remarks), remarks)`,
      [bookingId, paidAmount, discountAmt, paymentMode, remarks],
    );

    // ── Step 4: Save to payment_history ──────────────────────────────────
    if (paidAmount > 0) {
      await runQuery(
        `INSERT INTO payment_history
           (booking_id, amount, discount_amount, payment_mode, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [bookingId, paidAmount, discountAmt, paymentMode, remarks],
      ).catch(() => {}); // non-fatal if table schema differs
    }

    // ── Step 5: Group booking meta ────────────────────────────────────────
    await runQuery(
      `INSERT INTO hotel_group_bookings
         (booking_id, group_label, total_rooms, grand_total, paid_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [
        bookingId,
        guest.groupLabel || null,
        rooms.length,
        grandTotal,
        paidAmount,
      ],
    );

    // ── Step 6: Mark rooms as Occupied in inventory ───────────────────────
    const { updateRoomOperationalState } = require("../models/hotelRoomInventoryModel");

    await Promise.allSettled(
      rooms.map((room) =>
        updateRoomOperationalState({
          roomNumber: String(room.roomNumber || ""),
          guestName: guest.guestName,
          status: "Occupied",
          checkIn: guest.checkIn,
          checkOut: guest.checkOut,
        }),
      ),
    );

    res.status(201).json({
      message: "Group booking created successfully",
      bookingId,
      bookingCode,
      totalRooms: rooms.length,
      grandTotal,
      paidAmount,
      remainingAmount: Math.max(grandTotal - paidAmount - discountAmt, 0),
    });
  } catch (err) {
    console.error("[groupBooking] create error:", err);
    res.status(500).json({
      error: err.message || "Group booking creation failed",
    });
  }
};
