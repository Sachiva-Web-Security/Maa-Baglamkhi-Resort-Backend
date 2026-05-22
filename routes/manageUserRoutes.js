const router = require("express").Router();
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../models/manageUserModel");

router.get("/", async (_req, res) => {
  try {
    const rows = await listUsers();
    res.json(rows);
  } catch (error) {
    console.error("Manage users GET failed:", error);
    res.status(500).json({ message: "Failed to load users" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createUser(req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error("Manage user create failed:", error);
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A user with this email already exists"
        : error.message || "Failed to create",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateUser(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("Manage user update failed:", error);
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A user with this email already exists"
        : error.message || "Failed to update",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
