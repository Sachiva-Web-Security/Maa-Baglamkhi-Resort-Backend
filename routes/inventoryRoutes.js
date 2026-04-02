const router = require("express").Router();

const {
  createItem, getItems, getItem, updateItem, deleteItem,
  getLowStockAlerts, getExpiringItems,
  logWaste, getWasteLogs, updateWasteLog, deleteWasteLog,
  createPurchaseOrder, getPurchaseOrders, updatePurchaseOrder, deletePurchaseOrder,
  submitAudit, getAuditReport,
  recordTransfer, getTransfers, updateTransfer, deleteTransfer,
} = require("../controller/inventoryController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "kitchen", "accountant", "receptionist"];
const EDITORS = ["admin", "manager", "receptionist"];

router.get("/", authMiddleware, roleMiddleware(READERS), getItems);
router.get("/alerts/low-stock", authMiddleware, roleMiddleware(READERS), getLowStockAlerts);
router.get("/alerts/expiring", authMiddleware, roleMiddleware(READERS), getExpiringItems);

router.get("/waste", authMiddleware, roleMiddleware(READERS), getWasteLogs);
router.post("/waste", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "receptionist"]), logWaste);
router.put("/waste/:id", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "receptionist"]), updateWasteLog);
router.delete("/waste/:id", authMiddleware, roleMiddleware(EDITORS), deleteWasteLog);

router.get("/purchase-orders", authMiddleware, roleMiddleware(READERS), getPurchaseOrders);
router.post("/purchase-orders", authMiddleware, roleMiddleware(EDITORS), createPurchaseOrder);
router.put("/purchase-orders/:id", authMiddleware, roleMiddleware(EDITORS), updatePurchaseOrder);
router.delete("/purchase-orders/:id", authMiddleware, roleMiddleware(EDITORS), deletePurchaseOrder);

router.post("/audit", authMiddleware, roleMiddleware(EDITORS), submitAudit);
router.get("/audit/report", authMiddleware, roleMiddleware(READERS), getAuditReport);

router.get("/transfers", authMiddleware, roleMiddleware(READERS), getTransfers);
router.post("/transfers", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "receptionist"]), recordTransfer);
router.put("/transfers/:id", authMiddleware, roleMiddleware(["admin", "manager", "kitchen", "receptionist"]), updateTransfer);
router.delete("/transfers/:id", authMiddleware, roleMiddleware(EDITORS), deleteTransfer);

router.get("/:id", authMiddleware, roleMiddleware(READERS), getItem);
router.post("/", authMiddleware, roleMiddleware(EDITORS), createItem);
router.put("/:id", authMiddleware, roleMiddleware(EDITORS), updateItem);
router.delete("/:id", authMiddleware, roleMiddleware(EDITORS), deleteItem);

module.exports = router;
