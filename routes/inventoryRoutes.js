const router = require("express").Router();
console.log("✅ inventoryRoutes loaded");

const {
  createItem, getItems, getItem, updateItem, deleteItem,
  getLowStockAlerts, getExpiringItems,
  logWaste, getWasteLogs,
  createPurchaseOrder, getPurchaseOrders, updatePurchaseOrder, deletePurchaseOrder,
  submitAudit, getAuditReport,
  recordTransfer, getTransfers,
} = require("../controller/inventoryController");

const authMiddleware  = require("../middleware/authMiddleware");
const roleMiddleware  = require("../middleware/roleMiddleware");

// ── Allowed role sets ──────────────────────────────────────────────────────
// Readers  : all authenticated roles that see inventory
// Editors  : admin + manager (can add/edit/delete items)
// Kitchen  : admin + manager + kitchen (can read and do transfers/waste)

const READERS  = ["admin", "manager", "kitchen", "accountant"];
const EDITORS  = ["admin", "manager"];

// ══════════════════════════════════════════════════════════════════════════════
// Inventory Items
// ══════════════════════════════════════════════════════════════════════════════

router.get(   "/",    authMiddleware, roleMiddleware(READERS),  getItems);
router.get(   "/:id", authMiddleware, roleMiddleware(READERS),  getItem);
router.post(  "/",    authMiddleware, roleMiddleware(EDITORS),  (req, res, next) => { console.log("📦 POST /api/inventory"); next(); }, createItem);
router.put(   "/:id", authMiddleware, roleMiddleware(EDITORS),  updateItem);
router.delete("/:id", authMiddleware, roleMiddleware(EDITORS),  deleteItem);

// ══════════════════════════════════════════════════════════════════════════════
// Alerts
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/inventory/alerts/low-stock
router.get("/alerts/low-stock",      authMiddleware, roleMiddleware(READERS),          getLowStockAlerts);
// GET /api/inventory/alerts/expiring?days=30
router.get("/alerts/expiring",       authMiddleware, roleMiddleware(READERS),          getExpiringItems);

// ══════════════════════════════════════════════════════════════════════════════
// Waste / Spoilage Log
// ══════════════════════════════════════════════════════════════════════════════

// GET  /api/inventory/waste
// POST /api/inventory/waste
router.get( "/waste", authMiddleware, roleMiddleware(READERS),                         getWasteLogs);
router.post("/waste", authMiddleware, roleMiddleware(["admin","manager","kitchen"]),    logWaste);

// ══════════════════════════════════════════════════════════════════════════════
// Purchase Orders
// ══════════════════════════════════════════════════════════════════════════════

// GET    /api/inventory/purchase-orders
// POST   /api/inventory/purchase-orders
// PUT    /api/inventory/purchase-orders/:id
// DELETE /api/inventory/purchase-orders/:id
router.get(   "/purchase-orders",       authMiddleware, roleMiddleware(READERS),  getPurchaseOrders);
router.post(  "/purchase-orders",       authMiddleware, roleMiddleware(EDITORS),  createPurchaseOrder);
router.put(   "/purchase-orders/:id",   authMiddleware, roleMiddleware(EDITORS),  updatePurchaseOrder);
router.delete("/purchase-orders/:id",   authMiddleware, roleMiddleware(EDITORS),  deletePurchaseOrder);

// ══════════════════════════════════════════════════════════════════════════════
// Stock Audit
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/inventory/audit        — submit a full audit session
// GET  /api/inventory/audit/report — fetch past audits
router.post("/audit",         authMiddleware, roleMiddleware(EDITORS),  submitAudit);
router.get( "/audit/report",  authMiddleware, roleMiddleware(READERS),  getAuditReport);

// ══════════════════════════════════════════════════════════════════════════════
// Inter-Department Stock Transfers
// ══════════════════════════════════════════════════════════════════════════════

// GET  /api/inventory/transfers
// POST /api/inventory/transfers
router.get( "/transfers", authMiddleware, roleMiddleware(READERS),                          getTransfers);
router.post("/transfers", authMiddleware, roleMiddleware(["admin","manager","kitchen"]),     recordTransfer);

module.exports = router;