const router = require("express").Router();
const {
  listTerminals,
  createTerminal,
  updateTerminal,
  deleteTerminal,
} = require("../models/terminalModel");

router.get("/", async (_req, res) => {
  try {
    const rows = await listTerminals();
    res.json(rows);
  } catch (error) {
    console.error("Terminals GET failed:", error);
    res.status(500).json({ message: "Failed to load terminals" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createTerminal(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to create" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateTerminal(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Terminal not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteTerminal(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
