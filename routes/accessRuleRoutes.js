const router = require("express").Router();
const { list, create, update, remove } = require("../models/accessRuleModel");

router.get("/", async (req, res) => {
  try {
    const rows = await list({
      module: req.query.module || "",
      role: req.query.role || "",
      branch_id: req.query.branch_id || "",
    });
    res.json(rows);
  } catch (error) {
    console.error("Access rules GET failed:", error);
    res.status(500).json({ message: "Failed to load access rules" });
  }
});

router.post("/", async (req, res) => {
  try {
    res.status(201).json(await create(req.body));
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A rule for this module/role/branch already exists"
        : error.message || "Failed to create",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Rule not found" });
    res.json(updated);
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A rule for this module/role/branch already exists"
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
