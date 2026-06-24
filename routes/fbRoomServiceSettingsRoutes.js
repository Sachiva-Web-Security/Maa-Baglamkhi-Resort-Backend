const router = require("express").Router();
const { get, save } = require("../models/fbRoomServiceSettingsModel");
const sanitizeHtml = require("../middleware/sanitizeHtml");

router.get("/", async (_req, res) => {
  try {
    res.json(await get());
  } catch (error) {
    res.status(500).json({ message: "Failed to load settings" });
  }
});

router.put("/", sanitizeHtml(["invoice_note"]), async (req, res) => {
  try {
    res.json(await save(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to save" });
  }
});

module.exports = router;
