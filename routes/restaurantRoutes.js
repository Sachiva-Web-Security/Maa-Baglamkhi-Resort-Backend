const router = require("express").Router();
const RestaurantController = require("../controller/restaurantController"); // import full controller

// Tables
router.post("/add-table", RestaurantController.addTable);
router.get("/tables", RestaurantController.getTables);

// Orders / Billing
router.post("/add-item", RestaurantController.addItem);                     // menu item add
router.get("/orders/:tableNumber", RestaurantController.getPendingOrder);   // pending order fetch
router.post("/bill", RestaurantController.generateBill);                     // generate final bill

module.exports = router;