const db = require("../config/db");
const { BOOKING_STATUS, PAYMENT_STATUS } = require("../utils/bookingStatus");

async function createOrder(bookingId) {
  const [rows] = await db.promise().query(
    `SELECT id, booking_code, payment_amount, payment_status, booking_status
     FROM guests
     WHERE id = ?`,
    [bookingId]
  );

  if (!rows.length) {
    throw new Error("Booking not found");
  }

  const booking = rows[0];

  return {
    bookingId: booking.id,
    bookingCode: booking.booking_code,
    amount: booking.payment_amount,
    orderId: `ORDER-${booking.id}-${Date.now()}`,
    paymentStatus: booking.payment_status || PAYMENT_STATUS.PENDING,
  };
}

async function verifyPayment(payload) {
  const { bookingId, paymentId, paymentMethod = "manual" } = payload;

  if (!bookingId || !paymentId) {
    throw new Error("bookingId and paymentId are required");
  }

  await db.promise().query(
    `UPDATE guests
     SET payment_status = ?, payment_reference = ?, payment_method = ?, booking_status = ?
     WHERE id = ?`,
    [PAYMENT_STATUS.PAID, paymentId, paymentMethod, BOOKING_STATUS.CONFIRMED, bookingId]
  );

  const [rows] = await db.promise().query(
    `SELECT id, booking_code, booking_status, payment_status, payment_reference
     FROM guests
     WHERE id = ?`,
    [bookingId]
  );

  return rows[0];
}

module.exports = {
  createOrder,
  verifyPayment,
};
