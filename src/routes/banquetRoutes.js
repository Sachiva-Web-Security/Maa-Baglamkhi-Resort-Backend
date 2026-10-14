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
    // Match the camelCase shape that addBanquetHall/updateBanquetHall return,
    // so the frontend does not have to special-case list responses.
    const [rows] = await db.query(
      `SELECT id, name, description,
              capacity_min AS capacityMin, capacity_max AS capacityMax,
              rate_per_hour AS ratePerHour, rate_per_day AS ratePerDay,
              is_ac AS isAc, has_projector AS hasProjector,
              has_sound_system AS hasSoundSystem, has_stage AS hasStage,
              has_dance_floor AS hasDanceFloor, image_url AS imageUrl, status
       FROM banquet_halls ORDER BY id ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load halls", error: err.message });
  }
});
router.get("/bookings", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, hall_id AS hallId, customer_name AS customerName, phone,
              email AS guestEmail, event_title AS eventTitle, event_type AS eventType,
              guest_count AS guests, menu_package AS menuPackageId, meal_section AS mealSection,
              custom_menu_items AS customMenuItems, lighting_system AS lightingSystem,
              custom_menu_charge AS customMenuCharge, lighting_charge AS lightingCharge,
              event_support_fee AS eventSupportFee, hall_charge AS hallCharge,
              meal_charge AS mealCharge, decoration_fee AS decorationFee,
              event_date AS date, start_time AS startTime, end_time AS endTime,
              discount, gst_percent AS gstPercent, subtotal AS subtotalAmount,
              gst_amount AS gstAmount, total AS grandTotal, advance, balance AS balanceDue,
              status, invoice_no AS invoiceNo, created_by AS createdBy, created_at AS createdAt
       FROM banquet_bookings ORDER BY id DESC`
    );
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
