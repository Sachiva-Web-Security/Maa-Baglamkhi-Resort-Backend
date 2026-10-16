// routes/kitchenRoutes.js
// FIX: Added DELETE /orders/:id (removeKitchenOrder) - was missing, crashed Kitchen.jsx
const express = require("express");
const router  = express.Router();
const kitchenController = require("../controller/kitchenController");

router.post("/order",           kitchenController.createOrder);
router.get("/orders",           kitchenController.getOrders);
router.put("/orders/:id",       kitchenController.updateOrderStatus);
router.put("/orders/:id/save",  kitchenController.saveOrder);
router.put("/orders/:id/cancel",kitchenController.cancelOrder);
// FIX: was missing in original kitchenRoutes.js
router.delete("/orders/:id",    kitchenController.removeOrder);

module.exports = router;
