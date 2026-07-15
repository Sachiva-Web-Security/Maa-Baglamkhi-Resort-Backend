const express = require("express");
const router = express.Router();
const {
  ensureSchema,
  listNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteNotification,
} = require("../controller/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Ensure table exists on every notification request (lazy DDL)
router.use(ensureSchema);

router.get("/", listNotifications);
router.post("/:id/read", markAsRead);
router.post("/mark-all-read", markAllAsRead);
router.post("/", createNotification);
router.delete("/:id", deleteNotification);

module.exports = router;
