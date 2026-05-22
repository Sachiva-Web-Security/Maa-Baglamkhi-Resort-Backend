const router = require("express").Router();
const {
  listTaxCategories,
  createTaxCategory,
  updateTaxCategory,
  deleteTaxCategory,
} = require("../models/taxCategoryModel");

router.get("/", async (_req, res) => {
  try {
    const rows = await listTaxCategories();
    res.json(rows);
  } catch (error) {
    console.error("Tax categories GET failed:", error);
    res.status(500).json({ message: "Failed to load tax categories" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createTaxCategory(req.body?.name);
    res.status(201).json(created);
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A tax category with this name already exists"
        : error.message || "Failed to create",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateTaxCategory(req.params.id, req.body?.name);
    res.json(updated);
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A tax category with this name already exists"
        : error.message || "Failed to update",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteTaxCategory(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
