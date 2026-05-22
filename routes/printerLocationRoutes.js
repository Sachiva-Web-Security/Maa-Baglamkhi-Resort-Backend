const router = require("express").Router();
const { list, create, update, remove } = require("../models/printerLocationModel");

router.get("/", async (_req, res) => {
  try {
    res.json(await list());
  } catch (error) {
    res.status(500).json({ message: "Failed to load printer locations" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await create(req.body?.name);
    res.status(201).json(created);
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A printer location with this name already exists"
        : error.message || "Failed to create",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    res.json(await update(req.params.id, req.body?.name));
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A printer location with this name already exists"
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
