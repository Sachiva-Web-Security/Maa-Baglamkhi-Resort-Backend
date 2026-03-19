const express = require("express");
const router = express.Router();

const bookingController = require("../controller/bookingController");

// CREATE
router.post("/guest", bookingController.createGuest);
router.post("/other-booking/:id", bookingController.updateOtherBooking);
router.post("/reference/:id", bookingController.updateReference);
router.post("/company/:id", bookingController.updateCompany);
router.post("/pax/:id", bookingController.updatePax);
router.post("/room-tariff/:id", bookingController.updateTariff);
router.post("/advance/:id", bookingController.updateAdvance);

// GET
router.get("/all-bookings", bookingController.getAllBookings);
router.get("/booking/:id", bookingController.getBookingById);

// UPDATE
router.put("/booking/:id", bookingController.updateBooking);
router.put("/full-booking/:id", bookingController.updateFullBooking);

// FULL GET
router.get("/full-booking/:id", bookingController.getFullBooking);

// DELETE + REFUND

router.post("/refund/:id", bookingController.refundBooking);

module.exports = router;