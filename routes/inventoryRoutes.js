const router = require("express").Router();

const {
  createItem, getItems, getItem, updateItem, deleteItem,
  getLowStockAlerts, getExpiringItems,
  logWaste, getWasteLogs,
  createPurchaseOrder, getPurchaseOrders, updatePurchaseOrder, deletePurchaseOrder,
  submitAudit, getAuditReport,
  recordTransfer, getTransfers,
} = require("../controller/inventoryController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "kitchen", "accountant"];
const EDITORS = ["admin", "manager"];

router.get("/", authMiddleware, roleMiddleware(READERS), getItems);
router.get("/:id", authMiddleware, roleMiddleware(READERS), getItem);
router.post("/", authMiddleware, roleMiddleware(EDITORS), createItem);
router.put("/:id", authMiddleware, roleMiddleware(EDITORS), updateItem);
router.delete("/:id", authMiddleware, roleMiddleware(EDITORS), deleteItem);

router.get("/alerts/low-stock", authMiddleware, roleMiddleware(READERS), getLowStockAlerts);
router.get("/alerts/expiring", authMiddleware, roleMiddleware(READERS), getExpiringItems);

router.get("/waste", authMiddleware, roleMiddleware(READERS), getWasteLogs);
router.post("/waste", authMiddleware, roleMiddleware(["admin", "manager", "kitchen"]), logWaste);

router.get("/purchase-orders", authMiddleware, roleMiddleware(READERS), getPurchaseOrders);
router.post("/purchase-orders", authMiddleware, roleMiddleware(EDITORS), createPurchaseOrder);
router.put("/purchase-orders/:id", authMiddleware, roleMiddleware(EDITORS), updatePurchaseOrder);
router.delete("/purchase-orders/:id", authMiddleware, roleMiddleware(EDITORS), deletePurchaseOrder);

router.post("/audit", authMiddleware, roleMiddleware(EDITORS), submitAudit);
router.get("/audit/report", authMiddleware, roleMiddleware(READERS), getAuditReport);

router.get("/transfers", authMiddleware, roleMiddleware(READERS), getTransfers);
router.post("/transfers", authMiddleware, roleMiddleware(["admin", "manager", "kitchen"]), recordTransfer);

module.exports = router;
