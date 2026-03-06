const router = require("express").Router();
const {
  getRoomsAndBookings,
  getRooms,
  getBookings,
  createBooking,
  checkout,
  extendBooking,
  shiftRoom,
  updateRoomStatus,
  nightAudit,
  addRoom,
} = require("../controller/hotelController");

router.get("/", getRoomsAndBookings);
router.get("/rooms", getRooms);
router.get("/bookings", getBookings);
router.post("/book", createBooking);
router.post("/checkout", checkout);
router.post("/extend", extendBooking);
router.post("/shift", shiftRoom);
router.post("/room", addRoom);
router.put("/room/:number/status", updateRoomStatus);
router.post("/night-audit", nightAudit);

module.exports = router;
