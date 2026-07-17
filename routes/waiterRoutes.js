const express = require("express");
const router  = express.Router();
const waiterController = require("../controller/waiterController");

// GET /api/waiter/orders/ready — list of orders ready for pickup
router.get("/orders/ready", waiterController.getReadyOrders);

// PATCH /api/waiter/orders/:id/pickup — atomic pickup (409 if already taken)
router.patch("/orders/:id/pickup", waiterController.pickupOrder);

// PATCH /api/waiter/orders/:id/served — mark picked-up order as served
router.patch("/orders/:id/served", waiterController.markServed);

// GET /api/waiter/live-board — all active orders with ownership flag
router.get("/live-board", waiterController.getLiveBoard);

module.exports = router;
