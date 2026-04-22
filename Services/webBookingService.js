const db = require("../config/db");
const { generateBookingCode } = require("../utils/generateBookingCode");
const { BOOKING_STATUS, PAYMENT_STATUS } = require("../utils/bookingStatus");

async function createWebsiteBooking(data) {
  const {
    name,
    email,
    phone,
    checkIn,
    checkOut,
    roomId,
    roomIds = [],
    paymentMethod = "pay_later",
  } = data;

  const conn = await db.promise().getConnection();

  try {
    if (!name || !phone || !checkIn || !checkOut) {
      throw new Error("Name, phone, check-in and check-out are required");
    }

    const requestedRoomIds = Array.isArray(roomIds) && roomIds.length > 0
      ? roomIds
      : roomId
        ? [roomId]
        : [];

    if (!Array.isArray(requestedRoomIds) || requestedRoomIds.length === 0) {
      throw new Error("Please select at least one room");
    }

    const normalizedRoomIds = [...new Set(requestedRoomIds.map((id) => Number(id)).filter(Boolean))];

    if (normalizedRoomIds.length !== requestedRoomIds.length) {
      throw new Error("Duplicate or invalid room selection found");
    }

    await conn.beginTransaction();

    const placeholders = normalizedRoomIds.map(() => "?").join(",");

    const [selectedRooms] = await conn.query(
      `SELECT
         r.id,
         r.room_number,
         r.status,
         c.base_price AS price
       FROM hotel_room_inventory r
       JOIN room_categories c ON c.id = r.category_id
       WHERE r.id IN (${placeholders})
         AND r.status = 'Available'
         AND (
           r.check_in IS NULL
           OR r.check_out IS NULL
           OR NOT (r.check_in <= ? AND r.check_out >= ?)
         )
       FOR UPDATE`,
      [...normalizedRoomIds, checkOut, checkIn]
    );

    if (selectedRooms.length !== normalizedRoomIds.length) {
      throw new Error("One or more selected rooms are no longer available");
    }

    const totalAmount = selectedRooms.reduce(
      (sum, room) => sum + Number(room.price || 0),
      0
    );

    const [guestResult] = await conn.query(
      `INSERT INTO guests
       (guest_name, mobile, guest_email, check_in, check_out, booking_status, booking_source, payment_status, payment_method, payment_amount)
       VALUES (?, ?, ?, ?, ?, ?, 'website', ?, ?, ?)`,
      [
        name,
        phone,
        email || null,
        checkIn,
        checkOut,
        BOOKING_STATUS.PENDING,
        PAYMENT_STATUS.PENDING,
        paymentMethod,
        totalAmount,
      ]
    );

    const bookingId = guestResult.insertId;
    const bookingCode = generateBookingCode(bookingId);

    await conn.query(
      `UPDATE guests SET booking_code = ? WHERE id = ?`,
      [bookingCode, bookingId]
    );

    for (const room of selectedRooms) {
      await conn.query(
        `INSERT INTO room_tariff
         (booking_id, room_id, room_number, tariff, gst, total, quantity, category_name)
         VALUES (?, ?, ?, ?, 0, ?, 1, 'Room Charge')`,
        [
          bookingId,
          room.id,
          room.room_number,
          Number(room.price),
          Number(room.price),
        ]
      );
    }

    await conn.query(
      `UPDATE hotel_room_inventory
       SET status = 'Reserved', check_in = ?, check_out = ?
       WHERE id IN (${placeholders})`,
      [checkIn, checkOut, ...normalizedRoomIds]
    );

    await conn.commit();

    return {
      success: true,
      bookingId,
      bookingCode,
      bookingStatus: BOOKING_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING,
      totalAmount,
      roomId: selectedRooms[0]?.id || null,
      roomNumber: selectedRooms[0]?.room_number || null,
      selectedRooms: selectedRooms.map((room) => ({
        roomId: room.id,
        roomNumber: room.room_number,
        price: Number(room.price),
      })),
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getWebsiteBookingById(id) {
  const [rows] = await db.promise().query(
    `SELECT
       g.id,
       g.booking_code,
       g.guest_name,
       g.mobile,
       g.guest_email,
       g.check_in,
       g.check_out,
       g.booking_status,
       g.payment_status,
       g.payment_amount,
       rt.room_id,
       rt.room_number,
       rt.tariff,
       rt.total
     FROM guests g
     LEFT JOIN room_tariff rt ON rt.booking_id = g.id
     WHERE g.id = ? AND g.booking_source = 'website'`,
    [id]
  );

  if (!rows.length) return null;

  return {
    id: rows[0].id,
    booking_code: rows[0].booking_code,
    guest_name: rows[0].guest_name,
    mobile: rows[0].mobile,
    guest_email: rows[0].guest_email,
    check_in: rows[0].check_in,
    check_out: rows[0].check_out,
    booking_status: rows[0].booking_status,
    payment_status: rows[0].payment_status,
    payment_amount: rows[0].payment_amount,
    room_id: rows[0].room_id || null,
    room_number: rows[0].room_number || null,
    tariff: rows[0].tariff || null,
    total: rows[0].total || null,
    rooms: rows
      .filter((row) => row.room_id)
      .map((row) => ({
        room_id: row.room_id,
        room_number: row.room_number,
        tariff: row.tariff,
        total: row.total,
      })),
  };
}

async function getAllWebsiteBookings() {
  const [rows] = await db.promise().query(
    `SELECT id, booking_code, guest_name, mobile, guest_email, check_in, check_out, booking_status, payment_status
     FROM guests
     WHERE booking_source = 'website'
     ORDER BY id DESC`
  );
  return rows;
}

async function confirmWebsiteBooking(id) {
  await db.promise().query(
    `UPDATE guests
     SET booking_status = ?
     WHERE id = ?`,
    [BOOKING_STATUS.CONFIRMED, id]
  );

  return getWebsiteBookingById(id);
}

async function cancelWebsiteBooking(id) {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

    const [bookingRows] = await conn.query(
      `SELECT g.id, rt.room_id
       FROM guests g
       LEFT JOIN room_tariff rt ON rt.booking_id = g.id
       WHERE g.id = ? FOR UPDATE`,
      [id]
    );

    if (!bookingRows.length) {
      throw new Error("Booking not found");
    }

    const roomIds = bookingRows
      .map((row) => row.room_id)
      .filter(Boolean);

    await conn.query(
      `UPDATE guests SET booking_status = ? WHERE id = ?`,
      [BOOKING_STATUS.CANCELLED, id]
    );

    if (roomIds.length > 0) {
      const placeholders = roomIds.map(() => "?").join(",");
      await conn.query(
        `UPDATE hotel_room_inventory
         SET status = 'Available', check_in = NULL, check_out = NULL
         WHERE id IN (${placeholders})`,
        roomIds
      );
    }

    await conn.commit();
    return true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  createWebsiteBooking,
  getWebsiteBookingById,
  getAllWebsiteBookings,
  confirmWebsiteBooking,
  cancelWebsiteBooking,
};
