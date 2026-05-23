const router = require("express").Router();
const { list, create, update, remove } = require("../models/inventoryIngredientModel");

router.get("/", async (req, res) => {
  try {
    res.json(
      await list({
        item_group_id: req.query.item_group_id || "",
        item_code: req.query.item_code || "",
        name: req.query.name || "",
      }),
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to load ingredients" });
  }
});

router.post("/", async (req, res) => {
  try {
    res.status(201).json(await create(req.body));
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "An ingredient with this item code already exists"
        : error.message || "Failed to create",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Ingredient not found" });
    res.json(updated);
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "An ingredient with this item code already exists"
        : error.message || "Failed to update",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await remove(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
