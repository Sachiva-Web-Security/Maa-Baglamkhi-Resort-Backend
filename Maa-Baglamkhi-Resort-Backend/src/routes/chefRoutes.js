const express = require("express");
const router = express.Router();
const chefController = require("../controller/chefController");
const kitchenController = require("../controller/kitchenController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Kitchen orders
router.get("/orders", chefController.getKitchenOrders);
router.put("/orders/:id/status", chefController.updateOrderStatus);
router.put("/orders/:id/cancel", kitchenController.cancelOrder);
router.put("/orders/:id/save", kitchenController.saveOrder);
router.delete("/orders/:id", kitchenController.removeOrder);

// Notifications
router.get("/notifications", chefController.getNotifications);
router.post("/notifications/:id/read", chefController.markNotificationRead);
router.post("/notifications/mark-all-read", chefController.markAllNotificationsRead);
router.post("/notifications", chefController.createKitchenNotification);
router.delete("/notifications/:id", chefController.deleteNotification);

module.exports = router;
