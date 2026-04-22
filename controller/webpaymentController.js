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
