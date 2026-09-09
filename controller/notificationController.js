// controller/notificationController.js
const NotificationModel = require("../models/NotificationModel");

exports.ensureSchema = NotificationModel.ensureSchema;

exports.listNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
    const rows = await NotificationModel.list({ user_id: userId, role, visibleRoles });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    await NotificationModel.markAsRead(req.params.id, userId, role);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark as read", error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    await NotificationModel.markAllAsRead(userId, role);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark all as read", error: error.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const result = await NotificationModel.create(req.body || {});
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create notification", error: error.message });
  }
};

// Exported so other controllers (e.g. kitchenController) can call this
// directly with a plain payload object.
exports._createNotification = NotificationModel.create;

exports.deleteNotification = async (req, res) => {
  try {
    await NotificationModel.remove(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete", error: error.message });
  }
};
