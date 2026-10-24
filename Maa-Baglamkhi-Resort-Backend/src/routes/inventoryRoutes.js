const router = require("express").Router();

const {
  createItem, getItems, getItem, updateItem, deleteItem,
  getLowStockAlerts, getExpiringItems,
  logWaste, getWasteLogs, updateWasteLog, deleteWasteLog,
  createPurchaseOrder, getPurchaseOrders, getPurchaseOrderById, updatePurchaseOrder, deletePurchaseOrder,
  submitAudit, getAuditReport,
  recordTransfer, getTransfers, updateTransfer, deleteTransfer,
  createVendorInward, getVendorInwards, updateVendorInward, deleteVendorInward,
  createVendorPayment, getVendorPayments, updateVendorPayment, deleteVendorPayment,
  getStockLedger, getStockFlowReport, getVendorInsights,
  createChefIssue, returnChefIssue, getChefIssues, getChefIssueById,
} = require("../controller/inventoryController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "kitchen", "chef", "accountant", "receptionist"];
const EDITORS = ["admin", "manager", "receptionist"];

router.get("/", authMiddleware, roleMiddleware(READERS), getItems);
router.get("/items", authMiddleware, roleMiddleware(READERS), getItems);
router.get("/vendors", authMiddleware, roleMiddleware(READERS), getVendorInwards);
router.get("/menu-list", authMiddleware, roleMiddleware(READERS), getItems);
router.get("/menu-items", authMiddleware, roleMiddleware(READERS), getItems);
router.get("/reports", authMiddleware, roleMiddleware(READERS), getStockLedger);
router.get("/alerts/low-stock", authMiddleware, roleMiddleware(READERS), getLowStockAlerts);
router.get("/alerts/expiring", authMiddleware, roleMiddleware(READERS), getExpiringItems);

router.get("/waste", authMiddleware, roleMiddleware(READERS), getWasteLogs);
router.post("/waste", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), logWaste);
router.put("/waste/:id", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), updateWasteLog);
router.delete("/waste/:id", authMiddleware, roleMiddleware(EDITORS), deleteWasteLog);

router.get("/purchase-orders", authMiddleware, roleMiddleware(READERS), getPurchaseOrders);
router.get("/purchase-orders/:id", authMiddleware, roleMiddleware(READERS), getPurchaseOrderById);
router.post("/purchase-orders", authMiddleware, roleMiddleware(EDITORS), createPurchaseOrder);
router.put("/purchase-orders/:id", authMiddleware, roleMiddleware(EDITORS), updatePurchaseOrder);
router.delete("/purchase-orders/:id", authMiddleware, roleMiddleware(EDITORS), deletePurchaseOrder);

router.get("/vendor-inwards", authMiddleware, roleMiddleware(READERS), getVendorInwards);
router.post("/vendor-inwards", authMiddleware, roleMiddleware(EDITORS), createVendorInward);
router.put("/vendor-inwards/:id", authMiddleware, roleMiddleware(EDITORS), updateVendorInward);
router.delete("/vendor-inwards/:id", authMiddleware, roleMiddleware(EDITORS), deleteVendorInward);

router.get("/vendor-payments", authMiddleware, roleMiddleware(READERS), getVendorPayments);
router.post("/vendor-payments", authMiddleware, roleMiddleware(EDITORS), createVendorPayment);
router.put("/vendor-payments/:id", authMiddleware, roleMiddleware(EDITORS), updateVendorPayment);
router.delete("/vendor-payments/:id", authMiddleware, roleMiddleware(EDITORS), deleteVendorPayment);

router.get("/stock-ledger", authMiddleware, roleMiddleware(READERS), getStockLedger);
router.get("/reports/stock-flow", authMiddleware, roleMiddleware(READERS), getStockFlowReport);
router.get("/vendor-insights", authMiddleware, roleMiddleware(READERS), getVendorInsights);

router.post("/audit", authMiddleware, roleMiddleware(EDITORS), submitAudit);
router.get("/audit/report", authMiddleware, roleMiddleware(READERS), getAuditReport);

router.get("/transfers", authMiddleware, roleMiddleware(READERS), getTransfers);
router.post("/transfers", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), recordTransfer);
router.put("/transfers/:id", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), updateTransfer);
router.delete("/transfers/:id", authMiddleware, roleMiddleware(EDITORS), deleteTransfer);

router.get("/chef-issues", authMiddleware, roleMiddleware(READERS), getChefIssues);
router.post("/chef-issues", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), createChefIssue);
router.put("/chef-issues/:id/return", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), returnChefIssue);
router.get("/chef-issues/:id", authMiddleware, roleMiddleware(READERS), getChefIssueById);

// ── Specific routes MUST come before /:id ────────────────────────────────────
router.get("/setup/categories", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/setup/vendors", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/setup/stores", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});

router.get("/stats", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json({ totalItems: 0, lowStockCount: 0, totalValue: 0 });
});

router.get("/purchases", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.post("/purchases", authMiddleware, roleMiddleware(EDITORS), (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
});

router.get("/stock", authMiddleware, roleMiddleware(READERS), async (req, res) => {
  const db = require("../config/db");
  const tableExists = async (tableName) => {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [tableName],
    );
    return Number(rows?.[0]?.c || 0) > 0;
  };
  const columnExists = async (tableName, columnName) => {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [tableName, columnName],
    );
    return Number(rows?.[0]?.c || 0) > 0;
  };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  try {
    if (!(await tableExists("inventory_stock"))) return res.json([]);

    const itemCols = ["name", "category", "category_id", "stock", "unit", "price", "reorder_point", "expiry", "is_perishable"];
    const hasItemCol = {};
    if (await tableExists("inventory_items")) {
      for (const c of itemCols) hasItemCol[c] = await columnExists("inventory_items", c);
    }

    const cols = itemCols.filter((c) => hasItemCol[c]);
    const itemSelect = cols.length ? cols.map((c) => `i.${c}`).join(", ") : "i.id";
    const locJoin = await tableExists("inventory_locations")
      ? "LEFT JOIN inventory_locations l ON l.id = s.location_id"
      : "";

    const [rows] = await db.query(
      `SELECT s.id AS stockId, s.inventory_item_id AS itemId, s.quantity,
              s.batch_no AS batchNo, s.expiry_date AS expiryDate,
              s.location_id AS locationId, l.name AS store,
              ${itemSelect}
       FROM inventory_stock s
       ${locJoin}
       LEFT JOIN inventory_items i ON i.id = s.inventory_item_id
       ORDER BY i.name, l.name`,
    );

    res.json(
      rows.map((r) => ({
        stockId: r.stockId,
        id: r.itemId,
        itemId: r.itemId,
        itemName: r.name || null,
        category: r.category ?? null,
        quantity: num(r.quantity),
        stock: num(r.quantity),
        reorderLevel: hasItemCol.reorder_point ? num(r.reorder_point) : 5,
        expiryDate: r.expiryDate ? String(r.expiryDate).slice(0, 10) : null,
        store: r.store || null,
        unit: r.unit ?? null,
        price: r.price != null ? num(r.price) : 0,
        type: hasItemCol.is_perishable ? (r.is_perishable ? "menu" : "raw") : "raw",
      })),
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stock.", error });
  }
});
router.post("/stock", authMiddleware, roleMiddleware(EDITORS), (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
});
router.post("/stock-action", authMiddleware, roleMiddleware(EDITORS), (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
});

router.get("/reports/vendor-spend", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/reports/stock-value", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/reports/expiry-batches", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/reports/consumption", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/reports/audit-trail", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});

// Catch-all /:id MUST be last
router.get("/:id", authMiddleware, roleMiddleware(READERS), getItem);
router.post("/", authMiddleware, roleMiddleware(EDITORS), createItem);
router.put("/:id", authMiddleware, roleMiddleware(EDITORS), updateItem);
router.delete("/:id", authMiddleware, roleMiddleware(EDITORS), deleteItem);

router.get("/reports/vendor-spend", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/reports/stock-value", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/reports/expiry-batches", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});
router.get("/reports/consumption", authMiddleware, roleMiddleware(READERS), (req, res) => {
  res.json([]);
});

module.exports = router;
