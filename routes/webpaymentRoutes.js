const express = require("express");
const router = express.Router();
const {
  createBookingPaymentOrder,
  verifyBookingPayment,
} = require("../controller/webPaymentController");

router.post("/order", createBookingPaymentOrder);
router.post("/verify", verifyBookingPayment);

module.exports = router;
