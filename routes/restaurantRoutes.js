const express = require("express");
const router = express.Router();
const controller = require("../controller/restaurantController");
const upload = require("../utils/upload");

// TABLES
router.post("/tables", controller.addTable);
router.get("/tables", controller.getTables);

// MENU
router.post("/menu", upload.single("image"), controller.addMenuItem);
router.get("/menu", controller.getMenuItems);

// ORDER
router.post("/order/add", controller.addOrderItem);
router.get("/order/:tableNumber", controller.getOrder);
router.put("/order/:tableNumber/pay", controller.payOrder);

router.get("/order-items/:orderId", controller.getOrderItems);
router.post("/bill", controller.createBill);
router.get("/bills", controller.getBills);

module.exports = router;
