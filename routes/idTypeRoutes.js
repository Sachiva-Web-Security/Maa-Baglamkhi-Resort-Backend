const router = require("express").Router();
const {
  listIdTypes,
  createIdType,
  updateIdType,
  deleteIdType,
} = require("../models/idTypeModel");

router.get("/", async (_req, res) => {
  try {
    const rows = await listIdTypes();
    res.json(rows);
  } catch (error) {
    console.error("ID types GET failed:", error);
    res.status(500).json({ message: "Failed to load ID types" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createIdType(req.body?.name);
    res.status(201).json(created);
  } catch (error) {
    console.error("ID type create failed:", error);
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "An ID type with this name already exists"
        : error.message || "Failed to create",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateIdType(req.params.id, req.body?.name);
    res.json(updated);
  } catch (error) {
    console.error("ID type update failed:", error);
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "An ID type with this name already exists"
        : error.message || "Failed to update",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteIdType(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error("ID type delete failed:", error);
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
