const router = require("express").Router();
const { get, save } = require("../models/foSettingsModel");

router.get("/", async (_req, res) => {
  try {
    res.json((await get()) || {});
  } catch (error) {
    console.error("FO settings GET failed:", error);
    res.status(500).json({ message: "Failed to load settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    res.json(await save(req.body));
  } catch (error) {
    console.error("FO settings PUT failed:", error);
    res.status(400).json({ message: error.message || "Failed to save" });
  }
});

module.exports = router;
