const express = require("express");
const router = express.Router();

const controller = require("../controller/banquetInquiryController");

router.get("/inquiries", controller.getAllInquiries);
router.get("/halls", controller.getHalls);
router.get("/config", controller.getConfig);
router.get("/availability", controller.getAvailability);
router.post("/inquiries", controller.createInquiry);
router.post("/bookings", controller.createBooking);
router.get("/bookings/:id", controller.getBookingById);
router.post("/bookings/payment/order", controller.createBookingPaymentOrder);
router.post("/bookings/payment/verify", controller.verifyBookingPayment);
router.post("/bookings/payment/cancel", controller.cancelBookingPayment);

module.exports = router;
