const router = require("express").Router();
const {
  getFinancialYear,
  saveFinancialYear,
} = require("../models/financialYearModel");

router.get("/", async (_req, res) => {
  try {
    const fy = await getFinancialYear();
    res.json(fy || {});
  } catch (error) {
    console.error("Financial year GET failed:", error);
    res.status(500).json({ message: "Failed to load financial year" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { fy_start_date, fy_end_date } = req.body || {};
    if (!fy_start_date || !fy_end_date) {
      return res
        .status(400)
        .json({ message: "Both FY start and end dates are required" });
    }
    if (new Date(fy_end_date) <= new Date(fy_start_date)) {
      return res
        .status(400)
        .json({ message: "FY end date must be after start date" });
    }
    const updated = await saveFinancialYear({ fy_start_date, fy_end_date });
    res.json(updated);
  } catch (error) {
    console.error("Financial year PUT failed:", error);
    res.status(500).json({ message: error.message || "Failed to save" });
  }
});

module.exports = router;
