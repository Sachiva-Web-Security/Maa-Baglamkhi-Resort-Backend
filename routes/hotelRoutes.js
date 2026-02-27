const router = require("express").Router();
const {
  getRoomsAndBookings,
  createBooking,
  checkout,
} = require("../controller/hotelController");

router.get("/", getRoomsAndBookings);
router.post("/book", createBooking);
router.post("/checkout", checkout);

module.exports = router;

