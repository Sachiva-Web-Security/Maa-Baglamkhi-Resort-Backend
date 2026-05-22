const router = require("express").Router();
const {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require("../models/employeeModel");

router.get("/", async (_req, res) => {
  try {
    const rows = await listEmployees();
    res.json(rows);
  } catch (error) {
    console.error("Employees GET failed:", error);
    res.status(500).json({ message: "Failed to load employees" });
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await createEmployee(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to create" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await updateEmployee(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to update" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await deleteEmployee(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
