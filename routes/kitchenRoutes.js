const express = require("express");
const router = express.Router();

const kitchenController = require("../controller/kitchenController");

router.post("/order", kitchenController.createOrder);
router.get("/orders", kitchenController.getOrders);
router.put("/orders/:id", kitchenController.updateOrderStatus);

module.exports = router;