const router = require("express").Router();
const upload = require("../utils/upload");
const {
  getHallsAndBookings,
  createBooking,
  completeBooking,
  billBooking,
  createHall,
} = require("../controller/banquetController");

router.get("/", getHallsAndBookings);
router.post("/", createBooking);
router.post("/halls", upload.single("image"), createHall);
router.put("/:id/complete", completeBooking);
router.put("/:id/bill", billBooking);

module.exports = router;
