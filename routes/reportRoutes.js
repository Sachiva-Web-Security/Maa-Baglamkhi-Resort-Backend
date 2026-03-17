const express = require("express");
const router = express.Router();

const controller = require("../controller/reportController");

router.get("/daywise", controller.daywise);
router.get("/items", controller.itemConsumption);
router.get("/daywise-food", controller.daywiseFood);
router.get("/daily-room-food", controller.dailyRoomFood);

module.exports = router;
