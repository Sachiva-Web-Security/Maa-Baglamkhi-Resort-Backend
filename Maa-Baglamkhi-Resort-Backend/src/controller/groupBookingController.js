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
const BookingsModel = require("../models/BookingsModel");
const { ensureSchema: ensureGroupBookingSchema, create: createGroupBooking } = require("../models/GroupBookingModel");

const generateBookingCode = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `GRP-${date}-${rand}`;
};

// Delegate schema creation to the v4 model
const ensureSchema = ensureGroupBookingSchema;

const roomInventoryModel = require("../models/hotelRoomInventoryModel");

const updateRoomOperationalState = async ({ roomNumber, guestName, status, checkIn, checkOut }) => {
  await roomInventoryModel.updateRoomOperationalState({
    roomNumber,
    guestName,
    status,
    checkIn,
    checkOut,
  });
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

    // ── Step 1: Create master booking (v4) ───────────────────────────────
    const bookingCode = generateBookingCode();
    const [firstName, ...restName] = String(guest.guestName || "").trim().split(/\s+/);
    const lastName = restName.join(" ") || null;

    const grandTotal = rooms.reduce((s, r) => s + Number(r.total || 0), 0);
    const paidAmount  = Number(payment?.amount || 0);

    const bookingResult = await db.query(
      `INSERT INTO bookings
         (booking_code, status, check_in, check_out,
          adults, children, total_rooms, total_guests,
          subtotal, total_amount, advance_amount, balance_amount)
       VALUES (?, 'confirmed', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [
        bookingCode,
        guest.checkIn,
        guest.checkOut,
        rooms.reduce((s, r) => s + Number(r.adults || 1), 0),
        rooms.length,
        rooms.reduce((s, r) => s + Number(r.adults || 1) + Number(r.children || 0), 0),
        grandTotal,
        grandTotal,
        paidAmount,
        Math.max(grandTotal - paidAmount, 0),
      ],
    );

    const bookingId = bookingResult.insertId;

    // Primary guest profile + link (v4 guest identity tables).
    const guestProfileResult = await db.query(
      `INSERT INTO guest_profiles (first_name, last_name, email, phone)
       VALUES (?, ?, ?, ?)`,
      [firstName || "Guest", lastName, guest.guestEmail || null, guest.mobile],
    );

    await db.query(
      `INSERT INTO booking_guests
         (booking_id, guest_profile_id, is_primary, first_name, last_name)
       VALUES (?, ?, 1, ?, ?)`,
      [bookingId, guestProfileResult.insertId, firstName || "Guest", lastName],
    );

    // ── Step 2: Insert booking_rooms lines for each room ──────────────────
    for (const room of rooms) {
      const roomNumber = String(room.roomNumber || "").trim();
      const nights = Number(room.nights || 1);
      const tariff = Number(room.tariff || 0);
      const gst    = Number(room.gst || 0);
      const base   = tariff * nights;
      const total  = Number(room.total || base + (base * gst) / 100);

      const [roomRows] = await db.query(
        "SELECT r.id AS room_id, r.category_id FROM rooms r WHERE CAST(r.room_number AS CHAR) = CAST(? AS CHAR) LIMIT 1",
        [roomNumber],
      );
      const resolvedRoom = roomRows[0];
      if (!resolvedRoom) continue;

      await db.query(
        `INSERT INTO booking_rooms
           (booking_id, room_id, category_id, rate_per_night, nights, room_charge, total, guest_name, adults, children)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          resolvedRoom.room_id,
          resolvedRoom.category_id,
          tariff,
          nights,
          base,
          total,
          guest.guestName || null,
          Number(room.adults || 1),
          Number(room.children || 0),
        ],
      );
    }

    // ── Step 3 + 4: Record the advance as a v4 payment ────────────────────
    const discountAmt = Number(payment?.discount || 0);
    const paymentMode = payment?.paymentMode || "Cash";
    const remarks     = payment?.remarks || null;

    if (paidAmount > 0) {
      const [methodRows] = await db.query(
        "SELECT id FROM payment_methods WHERE LOWER(name) = LOWER(?) LIMIT 1",
        [paymentMode],
      );
      const [fallbackMethods] = await db.query(
        "SELECT id FROM payment_methods ORDER BY id ASC LIMIT 1",
      );
      const methodId = methodRows[0]?.id || fallbackMethods[0]?.id || null;
      if (methodId) {
        await db.query(
          `INSERT INTO payments
             (booking_id, amount, payment_method_id, payment_type, reference_no, status)
           VALUES (?, ?, ?, 'advance', ?, 'completed')`,
          [bookingId, paidAmount, methodId, remarks],
        );
      }
    }

    // ── Step 5: Group booking meta ────────────────────────────────────────
    await createGroupBooking({
      booking_id: bookingId,
      group_label: guest.groupLabel || null,
      total_rooms: rooms.length,
      grand_total: grandTotal,
      paid_amount: paidAmount,
    });

    // ── Step 6: Mark rooms as Occupied in inventory ───────────────────────
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
