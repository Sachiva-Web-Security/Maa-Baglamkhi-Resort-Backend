const express = require("express");
const router = express.Router();

const {
  getAvailableRooms,
  getCategoryAvailability,
  getRoomTypes,
  getRoomPrice,
  getAllRoomsForWebsite
} = require("../controller/roomController");

// APIs
router.get("/available", getAvailableRooms);
router.get("/category-availability", getCategoryAvailability);
router.get("/types", getRoomTypes);
router.get("/price/:roomId", getRoomPrice);

// new routes for get a room ok 

router.get("/website-rooms", getAllRoomsForWebsite);


module.exports = router;
