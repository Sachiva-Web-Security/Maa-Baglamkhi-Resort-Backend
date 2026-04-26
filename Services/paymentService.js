const crypto = require("crypto");
const Razorpay = require("razorpay");
const db = require("../config/db");
const { BOOKING_STATUS, PAYMENT_STATUS } = require("../utils/bookingStatus");

const normalizeText = (value) => String(value || "").trim();

function getRazorpayClient() {
  const keyId = normalizeText(process.env.RAZORPAY_KEY_ID);
  const keySecret = normalizeText(process.env.RAZORPAY_KEY_SECRET);

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured");
  }

  return {
    keyId,
    keySecret,
    client: new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    }),
  };
}

async function getBookingById(bookingId) {
  const [rows] = await db.promise().query(
    `SELECT
       id,
       booking_code,
       booking_source,
       payment_amount,
       payment_status,
       payment_method,
       booking_status,
       razorpay_order_id,
       razorpay_payment_id
     FROM guests
     WHERE id = ?`,
    [bookingId],
  );

  if (!rows.length) {
    throw new Error("Booking not found");
  }

  if (String(rows[0].booking_source || "").toLowerCase() !== "website") {
    throw new Error("Only website bookings are supported for this payment flow");
  }

  return rows[0];
}

async function createOrder(bookingId) {
  if (!Number(bookingId)) {
    throw new Error("bookingId is required");
  }

  const booking = await getBookingById(Number(bookingId));
  const amount = Number(booking.payment_amount || 0);

  if (!amount || amount <= 0) {
    throw new Error("Booking amount is invalid");
  }

  const { keyId, client } = getRazorpayClient();
  const order = await client.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: booking.booking_code || `BOOK-${booking.id}`,
    notes: {
      bookingId: String(booking.id),
      bookingCode: booking.booking_code || "",
    },
  });

  await db.promise().query(
    `UPDATE guests
     SET payment_status = ?, payment_method = ?, razorpay_order_id = ?
     WHERE id = ?`,
    [PAYMENT_STATUS.CREATED, "online", order.id, booking.id],
  );

  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    amount,
    currency: order.currency,
    orderId: order.id,
    key: keyId,
    paymentStatus: PAYMENT_STATUS.CREATED,
  };
}

async function verifyPayment(payload) {
  const bookingId = Number(payload.bookingId);
  const razorpayOrderId = normalizeText(payload.razorpay_order_id || payload.razorpayOrderId);
  const razorpayPaymentId = normalizeText(payload.razorpay_payment_id || payload.razorpayPaymentId);
  const razorpaySignature = normalizeText(payload.razorpay_signature || payload.razorpaySignature);
  const paymentMethod = normalizeText(payload.paymentMethod || "online");

  if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error(
      "bookingId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
    );
  }

  const booking = await getBookingById(bookingId);
  if (booking.razorpay_order_id && booking.razorpay_order_id !== razorpayOrderId) {
    throw new Error("Razorpay order id does not match the booking");
  }

  const { keySecret } = getRazorpayClient();
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Invalid payment signature");
  }

  await db.promise().query(
    `UPDATE guests
     SET
       payment_status = ?,
       payment_reference = ?,
       payment_method = ?,
       booking_status = ?,
       razorpay_order_id = ?,
       razorpay_payment_id = ?,
       paid_at = NOW()
     WHERE id = ?`,
    [
      PAYMENT_STATUS.PAID,
      razorpayPaymentId,
      paymentMethod,
      BOOKING_STATUS.CONFIRMED,
      razorpayOrderId,
      razorpayPaymentId,
      bookingId,
    ],
  );

  const [rows] = await db.promise().query(
    `SELECT
       id,
       booking_code,
       booking_status,
       payment_status,
       payment_reference,
       payment_method,
       razorpay_order_id,
       razorpay_payment_id,
       paid_at
     FROM guests
     WHERE id = ?`,
    [bookingId],
  );

  return rows[0];
}

async function cancelPayment(payload) {
  const bookingId = Number(payload.bookingId);

  if (!bookingId) {
    throw new Error("bookingId is required");
  }

  const conn = await db.promise().getConnection();

  try {
    await conn.beginTransaction();

    const [bookingRows] = await conn.query(
      `SELECT
         id,
         booking_source,
         booking_status,
         payment_status
       FROM guests
       WHERE id = ?
       FOR UPDATE`,
      [bookingId],
    );

    if (!bookingRows.length) {
      throw new Error("Booking not found");
    }

    const booking = bookingRows[0];
    if (String(booking.booking_source || "").toLowerCase() !== "website") {
      throw new Error("Only website bookings are supported for this payment flow");
    }

    if (String(booking.payment_status || "").toLowerCase() === PAYMENT_STATUS.PAID) {
      await conn.commit();
      return {
        bookingId,
        released: false,
        message: "Paid booking was not cancelled",
      };
    }

    const [roomRows] = await conn.query(
      `SELECT room_id
       FROM room_tariff
       WHERE booking_id = ?`,
      [bookingId],
    );

    const roomIds = roomRows.map((row) => Number(row.room_id)).filter(Boolean);

    await conn.query(
      `UPDATE guests
       SET
         booking_status = ?,
         payment_status = ?,
         payment_method = NULL,
         razorpay_order_id = NULL
       WHERE id = ?`,
      [BOOKING_STATUS.CANCELLED, PAYMENT_STATUS.FAILED, bookingId],
    );

    if (roomIds.length > 0) {
      const placeholders = roomIds.map(() => "?").join(",");
      await conn.query(
        `UPDATE hotel_room_inventory
         SET status = 'Available', check_in = NULL, check_out = NULL
         WHERE id IN (${placeholders})`,
        roomIds,
      );
    }

    await conn.commit();

    return {
      bookingId,
      released: true,
      message: "Pending booking cancelled and rooms released",
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  cancelPayment,
};
