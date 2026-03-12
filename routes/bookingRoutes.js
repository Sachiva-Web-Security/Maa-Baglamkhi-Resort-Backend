const express = require("express");
const router = express.Router();

const bookingController = require("../controller/bookingController");

router.post("/guest", bookingController.createGuest);
router.post("/other-booking/:id", bookingController.updateOtherBooking);
router.post("/reference/:id", bookingController.updateReference);
router.post("/company/:id", bookingController.updateCompany);
router.post("/pax/:id", bookingController.updatePax);
router.post("/room-tariff/:id", bookingController.updateTariff);
router.post("/advance/:id", bookingController.updateAdvance);

module.exports = router;