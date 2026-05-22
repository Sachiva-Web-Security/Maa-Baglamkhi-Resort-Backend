const router = require("express").Router();
const {
  listTaxSettings,
  createTaxSetting,
  updateTaxSetting,
  deleteTaxSetting,
} = require("../models/taxSettingModel");

router.get("/", async (_req, res) => {
  try {
    const rows = await listTaxSettings();
    res.json(rows);
  } catch (error) {
    console.error("Tax settings GET failed:", error);
    res.status(500).json({ message: "Failed to load tax settings" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createTaxSetting(req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error("Tax setting create failed:", error);
    res.status(400).json({ message: error.message || "Failed to create" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateTaxSetting(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Tax setting update failed:", error);
    res.status(400).json({ message: error.message || "Failed to update" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteTaxSetting(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
