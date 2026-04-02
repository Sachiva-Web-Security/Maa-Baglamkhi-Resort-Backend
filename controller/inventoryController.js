const Inventory = require("../models/InventoryModel");

const withInventorySchema = async (res, task) => {
  try {
    await Inventory.ensureSchema();
    await task();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to prepare inventory schema.",
      error,
    });
  }
};

exports.createItem = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.create(req.body, (err, result) => {
      if (err) {
        return res.status(500).json({ message: "Failed to create inventory item.", error: err });
      }
      res.status(201).json({ message: "Item added successfully.", id: result.insertId });
    });
  });
};

exports.getItems = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getAll((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch inventory.", error: err });
      res.json(results);
    });
  });
};

exports.getItem = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getById(req.params.id, (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch item.", error: err });
      if (!results.length) return res.status(404).json({ message: "Item not found." });
      res.json(results[0]);
    });
  });
};

exports.updateItem = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.update(req.params.id, req.body, (err) => {
      if (err) return res.status(500).json({ message: "Failed to update item.", error: err });
      res.json({ message: "Item updated successfully." });
    });
  });
};

exports.deleteItem = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.delete(req.params.id, (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete item.", error: err });
      res.json({ message: "Item deleted successfully." });
    });
  });
};

exports.getLowStockAlerts = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getLowStock((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch low stock alerts.", error: err });
      res.json(results);
    });
  });
};

exports.getExpiringItems = (req, res) => {
  const daysAhead = parseInt(req.query.days, 10) || 30;
  withInventorySchema(res, async () => {
    Inventory.getExpiringItems(daysAhead, (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch expiring items.", error: err });
      res.json(results);
    });
  });
};

exports.logWaste = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    Inventory.logWaste(data, (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to log waste.", error: err });
      res.status(201).json({ message: "Waste entry logged.", id: result.insertId });
    });
  });
};

exports.getWasteLogs = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getWasteLogs((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch waste logs.", error: err });
      res.json(results);
    });
  });
};

exports.updateWasteLog = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.updateWasteLog(req.params.id, req.body, (err) => {
      if (err) return res.status(500).json({ message: "Failed to update waste log.", error: err });
      res.json({ message: "Waste log updated." });
    });
  });
};

exports.deleteWasteLog = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.deleteWasteLog(req.params.id, (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete waste log.", error: err });
      res.json({ message: "Waste log deleted." });
    });
  });
};

exports.createPurchaseOrder = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    Inventory.createPurchaseOrder(data, (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to create purchase order.", error: err });
      res.status(201).json({ message: "Purchase order created.", id: result.insertId });
    });
  });
};

exports.getPurchaseOrders = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getPurchaseOrders((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch purchase orders.", error: err });
      res.json(results);
    });
  });
};

exports.updatePurchaseOrder = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.updatePurchaseOrder(req.params.id, req.body, (err) => {
      if (err) return res.status(500).json({ message: "Failed to update purchase order.", error: err });
      res.json({ message: "Purchase order updated." });
    });
  });
};

exports.deletePurchaseOrder = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.deletePurchaseOrder(req.params.id, (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete purchase order.", error: err });
      res.json({ message: "Purchase order deleted." });
    });
  });
};

exports.submitAudit = (req, res) => {
  const entries = req.body.entries || [];
  if (!entries.length) return res.status(400).json({ message: "No audit entries provided." });

  withInventorySchema(res, async () => {
    let completed = 0;
    const errors = [];

    entries.forEach((entry) => {
      const data = { ...entry, auditedBy: req.user?.username || "system" };
      Inventory.saveAuditEntry(data, (err) => {
        if (err) errors.push({ item: entry.itemName, error: err.message });
        completed += 1;
        if (completed === entries.length) {
          if (errors.length) return res.status(207).json({ message: "Partial audit saved.", errors });
          return res.json({ message: `Audit submitted for ${entries.length} items.` });
        }
        return null;
      });
    });
  });
};

exports.getAuditReport = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getAuditReport((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch audit report.", error: err });
      res.json(results);
    });
  });
};

exports.recordTransfer = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.recordTransfer(req.body, (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to record transfer.", error: err });
      res.status(201).json({ message: "Transfer recorded.", id: result.insertId });
    });
  });
};

exports.getTransfers = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getTransfers((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch transfers.", error: err });
      res.json(results);
    });
  });
};

exports.updateTransfer = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.updateTransfer(req.params.id, req.body, (err) => {
      if (err) return res.status(500).json({ message: "Failed to update transfer.", error: err });
      res.json({ message: "Transfer updated." });
    });
  });
};

exports.deleteTransfer = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.deleteTransfer(req.params.id, (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete transfer.", error: err });
      res.json({ message: "Transfer deleted." });
    });
  });
};
