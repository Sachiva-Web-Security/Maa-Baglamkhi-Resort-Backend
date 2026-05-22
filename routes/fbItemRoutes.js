const router = require("express").Router();
const {
  list,
  create,
  update,
  remove,
  getById,
  listRates,
  addRate,
  removeRate,
  getDiscount,
  saveDiscount,
} = require("../models/fbItemModel");

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
    res.status(500).json({ message: "Failed to load items" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const item = await getById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Failed to load item" });
  }
});

router.post("/", async (req, res) => {
  try {
    res.status(201).json(await create(req.body));
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to create" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Item not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update" });
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

// Item Rate history
router.get("/:id/rates", async (req, res) => {
  try {
    res.json(await listRates(req.params.id));
  } catch (error) {
    res.status(500).json({ message: "Failed to load rate history" });
  }
});

router.post("/:id/rates", async (req, res) => {
  try {
    res.status(201).json(await addRate(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to add rate" });
  }
});

router.delete("/:id/rates/:rateId", async (req, res) => {
  try {
    res.json(await removeRate(req.params.id, req.params.rateId));
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete rate" });
  }
});

// Item Discount
router.get("/:id/discount", async (req, res) => {
  try {
    res.json(await getDiscount(req.params.id));
  } catch (error) {
    res.status(500).json({ message: "Failed to load discount" });
  }
});

router.post("/:id/discount", async (req, res) => {
  try {
    res.json(await saveDiscount(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to save discount" });
  }
});

module.exports = router;
