const express = require("express");
const router = express.Router();
const controller = require("../controller/restaurantController");

// TABLES
router.post("/tables", controller.addTable);
router.get("/tables", controller.getTables);

// MENU
router.post("/menu", controller.addMenuItem);
router.get("/menu", controller.getMenuItems);

// ORDER
router.post("/order/add", controller.addOrderItem);
router.get("/order/:tableNumber", controller.getOrder);

// BILL
router.post("/bill", controller.createBill);

module.exports = router;