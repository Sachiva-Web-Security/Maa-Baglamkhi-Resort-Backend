const express = require("express");
const router = express.Router();
const upload = require("../utils/upload");

const {
  getBanquetPricingConfig,
  getBanquetDashboard,
  updateBanquetPricingConfig,
  createBanquetBooking,
  updateBanquetBooking,
  cancelBanquetBooking,
  refundBanquetBooking,
  deleteBanquetBooking,
  completeBanquetBooking,
  generateBanquetBill,
  addBanquetHall,
  updateBanquetHall,
  deleteBanquetHall,
} = require("../controller/banquetController");

router.get("/config", getBanquetPricingConfig);
router.put("/config", updateBanquetPricingConfig);
router.get("/", getBanquetDashboard);
router.post("/", createBanquetBooking);
router.put("/:id", updateBanquetBooking);
router.put("/:id/cancel", cancelBanquetBooking);
router.put("/:id/refund", refundBanquetBooking);
router.delete("/:id", deleteBanquetBooking);
router.put("/:id/complete", completeBanquetBooking);
router.put("/:id/bill", generateBanquetBill);
router.post("/halls", upload.single("image"), addBanquetHall);
router.put("/halls/:id", upload.single("image"), updateBanquetHall);
router.delete("/halls/:id", deleteBanquetHall);

module.exports = router;
