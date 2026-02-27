const router = require("express").Router();
const {
  getForDate,
  createManual,
} = require("../controller/attendanceController");

router.get("/", getForDate);
router.post("/", createManual);

module.exports = router;

