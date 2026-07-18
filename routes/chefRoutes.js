const express = require("express");
const router = express.Router();
const chefController = require("../controller/chefController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Kitchen orders
router.get("/orders", chefController.getKitchenOrders);
router.put("/orders/:id/status", chefController.updateOrderStatus);

// Notifications
router.get("/notifications", chefController.getNotifications);
router.post("/notifications/:id/read", chefController.markNotificationRead);
router.post("/notifications/mark-all-read", chefController.markAllNotificationsRead);
router.post("/notifications", chefController.createKitchenNotification);
router.delete("/notifications/:id", chefController.deleteNotification);

module.exports = router;
