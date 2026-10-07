const express = require("express");
const router = express.Router();
const upload = require("../utils/upload");
const db = require("../config/db");

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

const { sendBanquetInvoiceWhatsApp } = require("../controller/banquetWhatsappController");

router.get("/config", getBanquetPricingConfig);
router.put("/config", updateBanquetPricingConfig);
router.get("/", getBanquetDashboard);
router.get("/halls", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM banquet_halls ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load halls", error: err.message });
  }
});
router.get("/bookings", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM banquet_bookings ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load bookings", error: err.message });
  }
});
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

router.post("/invoice/send-whatsapp/:bookingId", sendBanquetInvoiceWhatsApp);

module.exports = router;
