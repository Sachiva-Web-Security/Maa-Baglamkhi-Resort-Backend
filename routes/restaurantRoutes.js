const express = require("express");
const router = express.Router();
const controller = require("../controller/restaurantController");
const upload = require("../utils/upload");

// TABLES
router.post("/tables", controller.addTable);
router.get("/tables", controller.getTables);
router.put("/tables/:id", controller.updateTable);
router.delete("/tables/:id", controller.deleteTable);
router.get("/waiter-performance", controller.getWaiterPerformance);

// MENU
router.get("/menu", controller.getMenuItems);
router.post("/menu", upload.single("image"), controller.addMenuItem);
router.put("/menu/:id", upload.single("image"), controller.updateMenuItem);
router.delete("/menu/:id", controller.deleteMenuItem);

router.post("/split-bills", controller.createSplitBill);
router.get("/item-action-requests", controller.getItemActionRequests);
router.post("/item-action-requests", controller.addItemActionRequest);
router.put("/item-action-requests/:id/review", controller.reviewItemActionRequest);

// ORDER
router.post("/order/add",          controller.addOrderItem);
router.get("/order/:tableNumber",  controller.getOrder);
router.get("/order-items/:orderId",controller.getOrderItems);
router.put("/order/:tableNumber/pay", controller.payOrder);

router.post("/bill", controller.createBill);
router.post("/bill/:id/pay", controller.payBill);
router.post("/bill/pay", controller.payBill);
router.get("/bills", controller.getBills);

// ── UTILITY ─────────────────────────────────────────────────────────
// FIX: was missing, caused TablePage to crash on mount
router.get("/waiter-performance",    controller.getWaiterPerformance);
// FIX: was missing, caused EditToken to crash
router.get("/item-action-requests",  controller.getItemActionRequests);

module.exports = router;
