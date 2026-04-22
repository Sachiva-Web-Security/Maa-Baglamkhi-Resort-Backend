const express = require("express");
const router = express.Router();

const {
  getAvailableRooms,
  getRoomTypes,
  getRoomPrice
} = require("../controller/roomController");

// APIs
router.get("/available", getAvailableRooms);
router.get("/types", getRoomTypes);
router.get("/price/:roomId", getRoomPrice);

module.exports = router;