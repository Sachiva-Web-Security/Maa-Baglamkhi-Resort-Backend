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
    const data = { ...req.body, createdBy: req.user?.username || "system" };
    Inventory.update(req.params.id, data, (err) => {
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
    try {
      const result = await Inventory.createWasteEntry(data);
      res.status(201).json({ message: "Waste entry logged.", id: result.id, stockUpdated: result.stockUpdated });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: "Failed to log waste.", error: err });
    }
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
    try {
      await Inventory.updateWasteEntry(req.params.id, req.body);
      res.json({ message: "Waste log updated." });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: "Failed to update waste log.", error: err });
    }
  });
};

exports.deleteWasteLog = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      await Inventory.deleteWasteEntry(req.params.id);
      res.json({ message: "Waste log deleted." });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: "Failed to delete waste log.", error: err });
    }
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

exports.createVendorInward = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    try {
      const result = await Inventory.createVendorInward(data);
      res.status(201).json({
        message: "Vendor inward recorded.",
        id: result.id,
        stockUpdated: result.stockUpdated,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to record vendor inward.", error: err });
    }
  });
};

exports.getVendorInwards = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getVendorInwards((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch vendor inwards.", error: err });
      res.json(results);
    });
  });
};

exports.updateVendorInward = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    try {
      const result = await Inventory.updateVendorInward(req.params.id, data);
      res.json({
        message: "Vendor inward updated.",
        stockUpdated: result.stockUpdated,
      });
    } catch (err) {
      const status = err?.statusCode || 500;
      res.status(status).json({ message: "Failed to update vendor inward.", error: err });
    }
  });
};

exports.deleteVendorInward = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      await Inventory.deleteVendorInward(req.params.id);
      res.json({ message: "Vendor inward deleted." });
    } catch (err) {
      const status = err?.statusCode || 500;
      res.status(status).json({ message: "Failed to delete vendor inward.", error: err });
    }
  });
};

exports.createVendorPayment = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    Inventory.createVendorPayment(data, (err, result) => {
      if (err) return res.status(500).json({ message: "Failed to create vendor payment.", error: err });
      res.status(201).json({ message: "Vendor payment recorded.", id: result.insertId });
    });
  });
};

exports.getVendorPayments = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getVendorPayments((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch vendor payments.", error: err });
      res.json(results);
    });
  });
};

exports.updateVendorPayment = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.updateVendorPayment(req.params.id, req.body, (err) => {
      if (err) return res.status(500).json({ message: "Failed to update vendor payment.", error: err });
      res.json({ message: "Vendor payment updated." });
    });
  });
};

exports.deleteVendorPayment = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.deleteVendorPayment(req.params.id, (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete vendor payment.", error: err });
      res.json({ message: "Vendor payment deleted." });
    });
  });
};

exports.getStockLedger = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getStockLedger((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch stock ledger.", error: err });
      res.json(results);
    });
  });
};

exports.getStockFlowReport = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      const result = await Inventory.getStockFlowReport({
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stock flow report.", error: err });
    }
  });
};

exports.getVendorInsights = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      const result = await Inventory.getVendorInsights();
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch vendor insights.", error: err });
    }
  });
};

exports.createChefIssue = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.name || req.user?.email || "system" };
  withInventorySchema(res, async () => {
    try {
      const result = await Inventory.createChefIssue(data);
      res.status(201).json({ message: "Item issued to chef.", record: result });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: err.message || "Failed to issue item.", error: err });
    }
  });
};

exports.returnChefIssue = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      const result = await Inventory.returnChefIssue(req.params.id, req.body);
      res.json({ message: "Return recorded.", record: result });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: err.message || "Failed to record return.", error: err });
    }
  });
};

exports.getChefIssues = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.chefId) filters.chefId = req.query.chefId;
      if (req.query.chefName) filters.chefName = req.query.chefName;
      const results = await new Promise((resolve, reject) => {
        Inventory.getChefIssues(filters, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch chef issues.", error: err });
    }
  });
};

exports.getChefIssueById = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      const results = await new Promise((resolve, reject) => {
        Inventory.getChefIssueById(req.params.id, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
      if (!results || !results.length) {
        return res.status(404).json({ message: "Chef issue record not found." });
      }
      res.json(results[0]);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch chef issue.", error: err });
    }
  });
};

/* ─── Flow: Purchases ───────────────────────────────────────────────────────── */

exports.getPurchases = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getPurchases(req.query || {}, (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch purchases.", error: err });
      res.json(results || []);
    });
  });
};

exports.createPurchase = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    Inventory.createPurchase(data, (err) => {
      if (err) return res.status(500).json({ message: "Failed to record purchase.", error: err });
      res.status(201).json({ message: "Purchase recorded." });
    });
  });
};

/* ─── Flow: Stock ───────────────────────────────────────────────────────────── */

exports.getStock = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getStock(req.query || {}, (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch stock log.", error: err });
      res.json(results || []);
    });
  });
};

exports.addStock = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    Inventory.addStockLog(data, (err) => {
      if (err) return res.status(500).json({ message: "Failed to add stock entry.", error: err });
      res.status(201).json({ message: "Stock entry added." });
    });
  });
};

/* ─── Flow: Stock actions ───────────────────────────────────────────────────── */

exports.createStockAction = (req, res) => {
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    Inventory.createStockAction(data, (err) => {
      if (err) return res.status(500).json({ message: "Failed to record stock action.", error: err });
      res.status(201).json({ message: "Stock action recorded." });
    });
  });
};

/* ─── Flow: Stats ───────────────────────────────────────────────────────────── */

exports.getInventoryStats = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getInventoryStats((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch stats.", error: err });
      const row = results?.[0] || {};
      res.json({
        totalItems: Number(row.total_items || 0),
        totalStock: Number(row.total_stock || 0),
        lowStock: Number(row.low_stock_count || 0),
        expiringSoon: Number(row.expiring_soon || 0),
        recentPurchases: Number(row.recent_purchases || 0),
        recentWaste: Number(row.recent_waste || 0),
        monthlySpend: Number(row.monthly_spend || 0),
      });
    });
  });
};

/* ─── Flow: Setup tabs ──────────────────────────────────────────────────────── */

exports.getSetupSections = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getSetupSections((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to load setup sections.", error: err });
      res.json(results || []);
    });
  });
};

exports.getSetupList = (req, res) => {
  const { sectionKey } = req.params;
  if (!["categories", "vendors", "stores"].includes(sectionKey)) {
    return res.status(400).json({ message: "Invalid section key." });
  }
  withInventorySchema(res, async () => {
    Inventory.getSetupList(sectionKey, (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to load setup list.", error: err });
      res.json(results || []);
    });
  });
};

exports.createSetupRecord = (req, res) => {
  const { sectionKey } = req.params;
  if (!["categories", "vendors", "stores"].includes(sectionKey)) {
    return res.status(400).json({ message: "Invalid section key." });
  }
  const data = { ...req.body, createdBy: req.user?.username || "system" };
  withInventorySchema(res, async () => {
    Inventory.createSetupRecord(sectionKey, data, (err) => {
      if (err) return res.status(500).json({ message: "Failed to create record.", error: err });
      res.status(201).json({ message: "Record created." });
    });
  });
};

exports.updateSetupRecord = (req, res) => {
  const { sectionKey, id } = req.params;
  if (!["categories", "vendors", "stores"].includes(sectionKey)) {
    return res.status(400).json({ message: "Invalid section key." });
  }
  withInventorySchema(res, async () => {
    Inventory.updateSetupRecord(sectionKey, id, req.body, (err) => {
      if (err) return res.status(500).json({ message: "Failed to update record.", error: err });
      res.json({ message: "Record updated." });
    });
  });
};

exports.deleteSetupRecord = (req, res) => {
  const { sectionKey, id } = req.params;
  if (!["categories", "vendors", "stores"].includes(sectionKey)) {
    return res.status(400).json({ message: "Invalid section key." });
  }
  withInventorySchema(res, async () => {
    Inventory.deleteSetupRecord(sectionKey, id, (err) => {
      if (err) return res.status(500).json({ message: "Failed to delete record.", error: err });
      res.json({ message: "Record deleted." });
    });
  });
};

/* ─── Flow: Reports ─────────────────────────────────────────────────────────── */

exports.getVendorSpendReport = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getVendorSpendReport(req.query || {}, (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch vendor spend report.", error: err });
      res.json(results || []);
    });
  });
};

exports.getStockValueReport = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getStockValueReport((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch stock value report.", error: err });
      res.json(results || []);
    });
  });
};

exports.getExpiryBatchesReport = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getExpiryBatchesReport((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch expiry report.", error: err });
      res.json(results || []);
    });
  });
};

exports.getConsumptionReport = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getConsumptionReport(req.query || {}, (err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch consumption report.", error: err });
      res.json(results || []);
    });
  });
};

exports.getAuditTrailReport = (req, res) => {
  withInventorySchema(res, async () => {
    Inventory.getAuditTrailReport((err, results) => {
      if (err) return res.status(500).json({ message: "Failed to fetch audit trail report.", error: err });
      res.json(results || []);
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
    try {
      const result = await Inventory.createTransferEntry(req.body);
      res.status(201).json({ message: "Transfer recorded.", id: result.id });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: "Failed to record transfer.", error: err });
    }
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
    try {
      await Inventory.updateTransferEntry(req.params.id, req.body);
      res.json({ message: "Transfer updated." });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: "Failed to update transfer.", error: err });
    }
  });
};

exports.deleteTransfer = (req, res) => {
  withInventorySchema(res, async () => {
    try {
      await Inventory.deleteTransferEntry(req.params.id);
      res.json({ message: "Transfer deleted." });
    } catch (err) {
      res.status(err?.statusCode || 500).json({ message: "Failed to delete transfer.", error: err });
    }
  });
};