const express = require("express");
const router = express.Router();


const controller = require("../controller/webBookingController");
const authMiddleware = require("../middleware/authMiddleware");

const {
  bookRoomFromWebsite,
  getWebsiteBookingById,
  getAllWebsiteBookings,
  confirmWebsiteBooking,
  cancelWebsiteBooking,
} = require("../controller/webBookingController");

router.post("/book", bookRoomFromWebsite);
router.get("/booking/:id", authMiddleware, getWebsiteBookingById);
router.patch("/booking/:id/cancel", authMiddleware, cancelWebsiteBooking);
router.get("/bookings", getAllWebsiteBookings);
router.patch("/booking/:id/confirm", confirmWebsiteBooking);
router.patch("/booking/:id/cancel", authMiddleware, cancelWebsiteBooking);
router.get("/my-bookings", authMiddleware, controller.getMyBookings);
module.exports = router;
