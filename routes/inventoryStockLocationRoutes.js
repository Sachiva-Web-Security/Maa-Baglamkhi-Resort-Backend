const router = require("express").Router();
const { list } = require("../models/inventoryStockLocationModel");

router.get("/", async (_req, res) => {
  try {
    res.json(await list());
  } catch (error) {
    res.status(500).json({ message: "Failed to load stock locations" });
  }
});

module.exports = router;
