const router = require("express").Router();
const {
  getHallsAndBookings,
  createBooking,
  completeBooking,
  billBooking,
} = require("../controller/banquetController");

router.get("/", getHallsAndBookings);
router.post("/", createBooking);
router.put("/:id/complete", completeBooking);
router.put("/:id/bill", billBooking);

module.exports = router;

