const router = require("express").Router();
const upload = require("../utils/upload");
const {
  getHotelInfo,
  saveHotelInfo,
} = require("../models/hotelInfoModel");

router.get("/", async (_req, res) => {
  try {
    const info = await getHotelInfo();
    res.json(info || {});
  } catch (error) {
    console.error("Hotel info GET failed:", error);
    res.status(500).json({ message: "Failed to load hotel info" });
  }
});

router.put("/", async (req, res) => {
  try {
    const allowed = [
      "hotel_name",
      "address_line1",
      "address_line2",
      "district",
      "pincode",
      "landline1",
      "landline2",
      "mobile1",
      "mobile2",
      "email",
      "website",
      "gst_number",
      "pan_card",
      "cheque_payable_to",
      "invoice_note",
      "logo_url",
    ];
    const payload = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    });
    const updated = await saveHotelInfo(payload);
    res.json(updated);
  } catch (error) {
    console.error("Hotel info PUT failed:", error);
    res.status(500).json({ message: "Failed to save hotel info" });
  }
});

router.post("/logo", upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    const updated = await saveHotelInfo({ logo_url: logoUrl });
    res.json({ logo_url: logoUrl, hotel: updated });
  } catch (error) {
    console.error("Hotel logo upload failed:", error);
    res.status(500).json({ message: "Logo upload failed" });
  }
});

module.exports = router;
