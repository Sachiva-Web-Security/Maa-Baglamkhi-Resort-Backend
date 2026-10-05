const express = require("express");
const router = express.Router();
const {
  listNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  deleteNotification,
} = require("../controller/notificationController");
const { ensureSchema: ensureNotificationSchema } = require("../models/NotificationsModel");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

// Ensure the table exists before handling a request (lazy DDL).
// ensureSchema() takes no arguments, so it cannot be used as bare middleware —
// that form never calls next() and the request hangs forever.
let notificationSchemaReady = null;
router.use((req, res, next) => {
  if (!notificationSchemaReady) {
    notificationSchemaReady = ensureNotificationSchema().catch((err) => {
      notificationSchemaReady = null;
      throw err;
    });
  }
  notificationSchemaReady.then(() => next(), next);
});

router.get("/", listNotifications);
router.post("/:id/read", markAsRead);
router.post("/mark-all-read", markAllAsRead);
router.post("/", createNotification);
router.delete("/:id", deleteNotification);

module.exports = router;
