const express = require("express");
const router = express.Router();
const {
  bookRoomFromWebsite,
  getWebsiteBookingById,
  getAllWebsiteBookings,
  confirmWebsiteBooking,
  cancelWebsiteBooking,
} = require("../controller/webBookingController");

router.post("/book", bookRoomFromWebsite);
router.get("/booking/:id", getWebsiteBookingById);
router.get("/bookings", getAllWebsiteBookings);
router.patch("/booking/:id/confirm", confirmWebsiteBooking);
router.patch("/booking/:id/cancel", cancelWebsiteBooking);

module.exports = router;
