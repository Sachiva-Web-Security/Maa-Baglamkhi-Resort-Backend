const express = require("express");
const router = express.Router();

const bookingController = require("../controller/bookingController");
const hotelRoomInventoryController = require("../controller/hotelRoomInventoryController");

router.use(hotelRoomInventoryController.bootstrap);

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
router.get("/rooms/setup", hotelRoomInventoryController.getRoomSetup);

// UPDATE
router.put("/booking/:id", bookingController.updateBooking);
router.put("/full-booking/:id", bookingController.updateFullBooking);
router.put("/check-in/:id", bookingController.checkInBooking);
router.put("/check-out/:id", bookingController.checkOutBooking);
router.put("/rooms/category/:id/price", hotelRoomInventoryController.updateCategoryPrice);
router.put("/rooms/state/:roomNumber", hotelRoomInventoryController.updateRoomOperationalState);

// FULL GET
router.get("/full-booking/:id", bookingController.getFullBooking);
router.get("/booking-history", bookingController.getBookingHistory);

// DELETE + REFUND
router.post("/rooms", hotelRoomInventoryController.addRoom);

router.post("/refund/:id", bookingController.refundBooking);

router.get("/payment-history/:id", bookingController.getPaymentHistory);

module.exports = router;
