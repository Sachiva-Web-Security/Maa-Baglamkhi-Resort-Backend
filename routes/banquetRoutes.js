const express = require("express");
const router = express.Router();

const {
  getBanquetDashboard,
  createBanquetBooking,
  updateBanquetBooking,
  completeBanquetBooking,
  cancelBanquetBooking,
  refundBanquetBooking,
  generateBanquetBill,
  deleteBanquetBooking,
  addBanquetHall,
  updateBanquetHall,
  deleteBanquetHall,
} = require("../controller/banquetController");

router.get("/", getBanquetDashboard);
router.post("/", createBanquetBooking);
router.put("/:id", updateBanquetBooking);
router.put("/:id/complete", completeBanquetBooking);
router.put("/:id/cancel", cancelBanquetBooking);
router.put("/:id/refund", refundBanquetBooking);
router.put("/:id/bill", generateBanquetBill);
router.delete("/:id", deleteBanquetBooking);
router.post("/halls", addBanquetHall);
router.put("/halls/:id", updateBanquetHall);
router.delete("/halls/:id", deleteBanquetHall);

module.exports = router;
