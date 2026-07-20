const router = require("express").Router();

const {
  createItem, getItems, getItem, updateItem, deleteItem,
  getLowStockAlerts, getExpiringItems,
  logWaste, getWasteLogs, updateWasteLog, deleteWasteLog,
  createPurchaseOrder, getPurchaseOrders, updatePurchaseOrder, deletePurchaseOrder,
  submitAudit, getAuditReport,
  recordTransfer, getTransfers, updateTransfer, deleteTransfer,
  createVendorInward, getVendorInwards, updateVendorInward, deleteVendorInward,
  createVendorPayment, getVendorPayments, updateVendorPayment, deleteVendorPayment,
  getStockLedger, getStockFlowReport, getVendorInsights,
} = require("../controller/inventoryController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "kitchen", "chef", "accountant", "receptionist"];
const EDITORS = ["admin", "manager", "receptionist"];

router.get("/", authMiddleware, roleMiddleware(READERS), getItems);
router.get("/alerts/low-stock", authMiddleware, roleMiddleware(READERS), getLowStockAlerts);
router.get("/alerts/expiring", authMiddleware, roleMiddleware(READERS), getExpiringItems);

router.get("/waste", authMiddleware, roleMiddleware(READERS), getWasteLogs);
router.post("/waste", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), logWaste);
router.put("/waste/:id", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "chef", "receptionist"]), updateWasteLog);
router.delete("/waste/:id", authMiddleware, roleMiddleware(EDITORS), deleteWasteLog);

router.get("/purchase-orders", authMiddleware, roleMiddleware(READERS), getPurchaseOrders);
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

router.get("/:id", authMiddleware, roleMiddleware(READERS), getItem);
router.post("/", authMiddleware, roleMiddleware(EDITORS), createItem);
router.put("/:id", authMiddleware, roleMiddleware(EDITORS), updateItem);
router.delete("/:id", authMiddleware, roleMiddleware(EDITORS), deleteItem);

module.exports = router;
