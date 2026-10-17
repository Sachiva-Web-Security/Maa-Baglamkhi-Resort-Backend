const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const controller = require("../controller/reportController");

// Daywise payment totals and item consumption aggregates.
router.use(authMiddleware);

router.get("/daywise", controller.daywise);
router.get("/items", controller.itemConsumption);

module.exports = router;
