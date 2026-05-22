const router = require("express").Router();
const { get, save } = require("../models/emailConfigModel");

router.get("/", async (_req, res) => {
  try {
    res.json((await get()) || {});
  } catch (error) {
    console.error("Email config GET failed:", error);
    res.status(500).json({ message: "Failed to load email config" });
  }
});

router.put("/", async (req, res) => {
  try {
    res.json(await save(req.body));
  } catch (error) {
    console.error("Email config PUT failed:", error);
    res.status(400).json({ message: error.message || "Failed to save" });
  }
});

module.exports = router;
