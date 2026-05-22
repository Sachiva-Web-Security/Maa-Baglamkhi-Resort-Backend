const router = require("express").Router();
const { list, create, update, remove } = require("../models/fbCaptainModel");

router.get("/", async (_req, res) => {
  try {
    res.json(await list());
  } catch (error) {
    res.status(500).json({ message: "Failed to load captains" });
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
    if (!updated) return res.status(404).json({ message: "Captain not found" });
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

module.exports = router;
