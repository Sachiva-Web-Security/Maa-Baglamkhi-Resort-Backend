const express = require("express");
const router = express.Router();

const controller = require("../controller/reportController");

router.get("/daywise", controller.daywise);
router.get("/items", controller.itemConsumption);

module.exports = router;