const paymentService = require("../services/paymentService");

exports.createBookingPaymentOrder = async (req, res) => {
  try {
    const result = await paymentService.createOrder(req.body.bookingId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyBookingPayment = async (req, res) => {
  try {
    const result = await paymentService.verifyPayment(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelBookingPayment = async (req, res) => {
  try {
    const result = await paymentService.cancelPayment(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const crypto = require("crypto");
const db = require("../config/db");
const { BOOKING_STATUS, PAYMENT_STATUS } = require("../utils/bookingStatus");

exports.handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    // ❌ invalid webhook
    if (expectedSignature !== signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    const event = JSON.parse(req.body);

    // 🔥 payment success event
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;

      const bookingId = payment.notes.bookingId;

      if (!bookingId) {
        return res.json({ success: true });
      }

      // ✅ booking update
      await db.promise().query(
        `UPDATE guests
         SET
           payment_status = ?,
           booking_status = ?,
           razorpay_payment_id = ?,
           paid_at = NOW()
         WHERE id = ?`,
        [
          PAYMENT_STATUS.PAID,
          BOOKING_STATUS.CONFIRMED,
          payment.id,
          bookingId,
        ]
      );

      console.log("✅ Webhook: Booking confirmed", bookingId);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ success: false });
  }
};


