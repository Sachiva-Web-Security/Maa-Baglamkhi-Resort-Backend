const express = require("express");
const router = express.Router();

const kitchenController = require("../controller/kitchenController");

router.post("/order", kitchenController.createOrder);
router.get("/orders", kitchenController.getOrders);
router.put("/orders/:id", kitchenController.updateOrderStatus);
router.put("/orders/:id/save", kitchenController.saveOrder);
router.put("/orders/:id/cancel", kitchenController.cancelOrder);

module.exports = router;
