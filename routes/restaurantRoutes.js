const express = require("express");
const controller = require("../controller/restaurantController");
const upload = require("../utils/upload");

const router = express.Router();

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

// ITEM ACTIONS / SPLIT BILLS
router.post("/split-bills", controller.createSplitBill);
router.get("/item-action-requests", controller.getItemActionRequests);
router.post("/item-action-requests", controller.addItemActionRequest);
router.put("/item-action-requests/:id/review", controller.reviewItemActionRequest);

// ORDERS
router.post("/order/add", controller.addOrderItem);
router.get("/order", controller.getOrders);
router.get("/order/:tableNumber", controller.getOrder);
router.put("/order/:orderId", controller.updateOrder);
router.delete("/order/:orderId", controller.deleteOrder);
router.post("/order/:orderId/remove", controller.removeOrderItem);
router.get("/order-items/:orderId", controller.getOrderItems);
router.put("/order/:tableNumber/pay", controller.payOrder);
router.post("/bill/:tableNumber/pay", controller.payBillByTableNumber);

// BILLS
router.post("/bill", controller.createBill);
router.post("/bill/send-whatsapp", controller.sendBillToWhatsApp);
router.post("/bill/:id/charge-to-room", controller.chargeBillToRoom);
router.post("/bill/charge-to-room", controller.chargeBillToRoom);
router.post("/bill/:id/pay", controller.payBill);
router.post("/bill/pay", controller.payBill);
router.get("/bills", controller.getBills);
router.get("/bills/filtered", controller.getFilteredBills);
router.get("/dashboard-summary", controller.getDashboardSummary);
router.get("/top-selling", controller.getTopSellingItems);

// KOT HISTORY
router.get("/kot-history", controller.getFilteredKotHistory);

module.exports = router;
