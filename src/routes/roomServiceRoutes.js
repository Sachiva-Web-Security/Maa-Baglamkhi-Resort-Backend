const express = require("express");
const router = express.Router();
const controller = require("../controller/roomServiceController");

// ROOMS
router.post("/rooms", controller.addRoom);
router.get("/rooms", controller.getRooms);

// ROOM MENU
router.post("/menu", controller.addMenuItem);
router.get("/menu", controller.getMenuItems);

// ROOM ORDER
router.post("/order/add", controller.addOrderItem);
router.get("/order/:roomNumber", controller.getOrder);
router.put("/order/:roomNumber/pay", controller.payOrder);

router.get("/order-items/:orderId", controller.getOrderItems);
router.post("/bill", controller.createBill);
router.get("/bill/:roomNumber", controller.generateBillForRoom);
router.put("/order/:orderId/status", controller.updateStatus);

module.exports = router;
