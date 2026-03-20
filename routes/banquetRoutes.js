const express = require("express");
const router = express.Router();

const {
  getBanquetDashboard,
  createBanquetBooking,
  completeBanquetBooking,
  generateBanquetBill,
  addBanquetHall,
} = require("../controller/banquetController");

router.get("/", getBanquetDashboard);
router.post("/", createBanquetBooking);
router.put("/:id/complete", completeBanquetBooking);
router.put("/:id/bill", generateBanquetBill);
router.post("/halls", addBanquetHall);

module.exports = router;
