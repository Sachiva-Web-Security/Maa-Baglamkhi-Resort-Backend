const Inventory = require("../models/InventoryModel");

// ── Inventory Items ─────────────────────────────────────────────────────────

exports.createItem = (req, res) => {
  console.log("➡️  createItem controller called", req.body);
  Inventory.create(req.body, (err, result) => {
    if (err) {
      console.error("❌ DB ERROR createItem:", err);
      return res.status(500).json({ message: "Failed to create inventory item.", error: err });
    }
    console.log("✅ Item inserted, ID:", result.insertId);
    res.status(201).json({ message: "Item added successfully.", id: result.insertId });
  });
};

exports.getItems = (req, res) => {
  Inventory.getAll((err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch inventory.", error: err });
    res.json(results);
  });
};

exports.getItem = (req, res) => {
  Inventory.getById(req.params.id, (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch item.", error: err });
    if (!results.length) return res.status(404).json({ message: "Item not found." });
    res.json(results[0]);
  });
};

exports.updateItem = (req, res) => {
  Inventory.update(req.params.id, req.body, (err) => {
    if (err) return res.status(500).json({ message: "Failed to update item.", error: err });
    res.json({ message: "Item updated successfully." });
  });
};

exports.deleteItem = (req, res) => {
  Inventory.delete(req.params.id, (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete item.", error: err });
    res.json({ message: "Item deleted successfully." });
  });
};

// ── Alerts ─────────────────────────────────────────────────────────────────

exports.getLowStockAlerts = (req, res) => {
  Inventory.getLowStock((err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch low stock alerts.", error: err });
    res.json(results);
  });
};

exports.getExpiringItems = (req, res) => {
  const daysAhead = parseInt(req.query.days) || 30;
  Inventory.getExpiringItems(daysAhead, (err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch expiring items.", error: err });
    res.json(results);
  });
};

// ── Waste / Spoilage Log ────────────────────────────────────────────────────

exports.logWaste = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  Inventory.logWaste(data, (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to log waste.", error: err });
    res.status(201).json({ message: "Waste entry logged.", id: result.insertId });
  });
};

exports.getWasteLogs = (req, res) => {
  Inventory.getWasteLogs((err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch waste logs.", error: err });
    res.json(results);
  });
};

// ── Purchase Orders ─────────────────────────────────────────────────────────

exports.createPurchaseOrder = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  Inventory.createPurchaseOrder(data, (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to create purchase order.", error: err });
    res.status(201).json({ message: "Purchase order created.", id: result.insertId });
  });
};

exports.getPurchaseOrders = (req, res) => {
  Inventory.getPurchaseOrders((err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch purchase orders.", error: err });
    res.json(results);
  });
};

exports.updatePurchaseOrder = (req, res) => {
  Inventory.updatePurchaseOrder(req.params.id, req.body, (err) => {
    if (err) return res.status(500).json({ message: "Failed to update purchase order.", error: err });
    res.json({ message: "Purchase order updated." });
  });
};

exports.deletePurchaseOrder = (req, res) => {
  Inventory.deletePurchaseOrder(req.params.id, (err) => {
    if (err) return res.status(500).json({ message: "Failed to delete purchase order.", error: err });
    res.json({ message: "Purchase order deleted." });
  });
};

// ── Stock Audit ─────────────────────────────────────────────────────────────

exports.submitAudit = (req, res) => {
  const entries = req.body.entries || [];
  if (!entries.length) return res.status(400).json({ message: "No audit entries provided." });

  let completed = 0;
  const errors = [];

  entries.forEach((entry) => {
    const data = { ...entry, auditedBy: req.user?.username || "system" };
    Inventory.saveAuditEntry(data, (err) => {
      if (err) errors.push({ item: entry.itemName, error: err.message });
      completed++;
      if (completed === entries.length) {
        if (errors.length) return res.status(207).json({ message: "Partial audit saved.", errors });
        res.json({ message: `Audit submitted for ${entries.length} items.` });
      }
    });
  });
};

exports.getAuditReport = (req, res) => {
  Inventory.getAuditReport((err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch audit report.", error: err });
    res.json(results);
  });
};

// ── Stock Transfers ─────────────────────────────────────────────────────────

exports.recordTransfer = (req, res) => {
  Inventory.recordTransfer(req.body, (err, result) => {
    if (err) return res.status(500).json({ message: "Failed to record transfer.", error: err });
    res.status(201).json({ message: "Transfer recorded.", id: result.insertId });
  });
};

exports.getTransfers = (req, res) => {
  Inventory.getTransfers((err, results) => {
    if (err) return res.status(500).json({ message: "Failed to fetch transfers.", error: err });
    res.json(results);
  });
};