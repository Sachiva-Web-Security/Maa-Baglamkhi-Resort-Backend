const express = require("express");
const router = express.Router();
const {
  createBookingPaymentOrder,
  verifyBookingPayment,
  cancelBookingPayment,
  handleWebhook
} = require("../controller/webpaymentController");

router.post("/order", createBookingPaymentOrder);
router.post("/verify", verifyBookingPayment);
router.post("/cancel", cancelBookingPayment);


// new ( most important)


router.post(
  "/webhook",
  express.raw({type:"application/json"}),
  handleWebhook
);



module.exports = router;
