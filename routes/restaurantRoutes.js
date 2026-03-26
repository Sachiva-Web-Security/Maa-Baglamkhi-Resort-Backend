const express = require("express");
const router = express.Router();
const controller = require("../controller/restaurantController");
const upload = require("../utils/upload");

// TABLES
router.post("/tables", controller.addTable);
router.get("/tables", controller.getTables);
router.get("/waiter-performance", controller.getWaiterPerformance);

// MENU
router.post("/menu", upload.single("image"), controller.addMenuItem);
router.get("/menu", controller.getMenuItems);
router.post("/split-bills", controller.createSplitBill);
router.get("/item-action-requests", controller.getItemActionRequests);
router.post("/item-action-requests", controller.addItemActionRequest);
router.put("/item-action-requests/:id/review", controller.reviewItemActionRequest);

// ORDER
router.post("/order/add", controller.addOrderItem);
router.get("/order/:tableNumber", controller.getOrder);
router.put("/order/:tableNumber/pay", controller.payOrder);

router.get("/order-items/:orderId", controller.getOrderItems);
router.post("/bill", controller.createBill);
router.get("/bills", controller.getBills);

module.exports = router;
