const db = require("../config/db");
const { generateBookingCode } = require("../utils/generateBookingCode");
const { BOOKING_STATUS, PAYMENT_STATUS } = require("../utils/bookingStatus");

async function createWebsiteBooking(data, user = null) {
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

// object destructuring

const customerId = user?.id || null;




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
         c.base_price AS price,
         c.name AS category_name
       FROM hotel_room_inventory r
       JOIN room_categories c ON c.id = r.category_id
       WHERE r.id IN (${placeholders})
         AND r.status = 'Available'
     AND (
  (r.check_in IS NULL AND r.check_out IS NULL)
  OR NOT (r.check_in <= ? AND r.check_out >= ?)
)
       FOR UPDATE`,
      [...normalizedRoomIds, checkOut, checkIn]
    );

    if (selectedRooms.length !== normalizedRoomIds.length) {
      throw new Error("One or more selected rooms are no longer available");
    }



const checkInDate = new Date(checkIn);
const checkOutDate = new Date(checkOut);

const numNights = Math.ceil(
  (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)
);

if (numNights < 1) {
  throw new Error("Check-out must be after check-in");
}





   const totalAmount = selectedRooms.reduce(
  (sum, room) => sum + Number(room.price || 0) * numNights,
  0
);

    const [guestResult] = await conn.query(
      `INSERT INTO guests
(guest_name, mobile, guest_email, check_in, check_out, booking_status, booking_source, payment_status, payment_method, payment_amount, customer_id)
       VALUES (?, ?, ?, ?, ?, ?, 'website', ?, ?, ?,?)`,
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
         customerId
      ]
    );

    const bookingId = guestResult.insertId;
    const bookingCode = generateBookingCode(bookingId);

    await conn.query(
      `UPDATE guests SET booking_code = ? WHERE id = ?`,
      [bookingCode, bookingId]
    );

    const gstRate = 0.12;

for (const room of selectedRooms) {
  const base = Number(room.price) * numNights;
  const gst = base * gstRate;
  const total = base + gst;

  await conn.query(
    `INSERT INTO room_tariff
     (booking_id, room_id, room_number, tariff, num_nights, gst, total, quantity, category_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      bookingId,
      room.id,
      room.room_number,
      Number(room.price),
      numNights,
      gst,
      total,
      room.category_name || "Room Charge",
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
async function getWebsiteBookingById(id, user) {

  let query = `
    SELECT
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
    WHERE g.id = ? 
    AND g.booking_source = 'website'
  `;

  const params = [id];

  // 🔥 CUSTOMER restriction
  if (user.role !== "admin") {
    query += " AND g.customer_id = ?";
    params.push(user.id);
  }

  const [rows] = await db.promise().query(query, params);















  if (!rows.length) return null;
return {
  booking: {
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
  },

  rooms: rows
    .filter((row) => row.room_id)
    .map((row) => ({
      room_id: row.room_id,
      room_number: row.room_number,
      tariff: row.tariff,
      total: row.total,
    })),

  summary: {
    totalAmount: rows[0].payment_amount
  }
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
async function confirmWebsiteBooking(id, user) {

  if (user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db.promise().query(
    `UPDATE guests
     SET booking_status = ?
     WHERE id = ?`,
    [BOOKING_STATUS.CONFIRMED, id]
  );

  return getWebsiteBookingById(id, user);
}






// ✅ यहाँ डालना है (separate function)

async function getMyBookings(userId) {
  const [rows] = await db.promise().query(
    `SELECT * FROM guests WHERE customer_id = ? ORDER BY id DESC`,
    [userId]
  );

  return rows;
}

// 👇 इसके बाद ये function आएगा






async function cancelWebsiteBooking(id,user) {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();

   let condition = "WHERE g.id = ?";
const params = [id];

if (user.role !== "admin") {
  condition += " AND g.customer_id = ?";
  params.push(user.id);
}

const [bookingRows] = await conn.query(
  `SELECT g.id, rt.room_id
   FROM guests g
   LEFT JOIN room_tariff rt ON rt.booking_id = g.id
   ${condition} FOR UPDATE`,
  params
);

    if (!bookingRows.length) {
      throw new Error("Booking not found");
    }









    

    const roomIds = bookingRows
      .map((row) => row.room_id)
      .filter(Boolean);

   await conn.query(
  `UPDATE guests SET booking_status = ? ${condition}`,
  [BOOKING_STATUS.CANCELLED, ...params]
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
   getMyBookings,
};
