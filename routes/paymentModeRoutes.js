const router = require("express").Router();
const {
  listPaymentModes,
  updateSlot,
  addSlot,
  deleteSlot,
} = require("../models/paymentModeModel");

router.get("/", async (_req, res) => {
  try {
    const rows = await listPaymentModes();
    res.json(rows);
  } catch (error) {
    console.error("Payment modes GET failed:", error);
    res.status(500).json({ message: "Failed to load payment modes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await addSlot(req.body?.name);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to add slot" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateSlot(req.params.id, req.body?.name);
    if (!updated) return res.status(404).json({ message: "Slot not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update slot" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteSlot(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete slot" });
  }
});

module.exports = router;
