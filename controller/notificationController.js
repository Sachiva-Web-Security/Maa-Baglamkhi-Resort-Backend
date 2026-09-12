const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

exports.listNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
    const isAdmin = role === "admin";

    let rows;
    if (isAdmin) {
      rows = await runQuery(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200`);
    } else {
      rows = await runQuery(
        `SELECT * FROM notifications WHERE user_id = ? OR user_role IN (?) ORDER BY created_at DESC LIMIT 200`,
        [userId, visibleRoles]
      );
    }
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin";
    const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];

    if (isAdmin) {
      await runQuery("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?", [req.params.id]);
    } else {
      await runQuery(
        "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND (user_id = ? OR user_role IN (?))",
        [req.params.id, userId, visibleRoles]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark as read", error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin";
    const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];

    if (isAdmin) {
      await runQuery("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE is_read = 0");
    } else {
      await runQuery(
        "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE is_read = 0 AND (user_id = ? OR user_role IN (?))",
        [userId, visibleRoles]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark all as read", error: error.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const payload = req.body || {};
    const [result] = await runQuery(
      `INSERT INTO notifications (user_id, user_role, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.user_id || null,
        payload.user_role || null,
        payload.type || "general",
        payload.title || "",
        payload.message || "",
        payload.data ? JSON.stringify(payload.data) : null,
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create notification", error: error.message });
  }
};

exports._createNotification = exports.createNotification;

exports.deleteNotification = async (req, res) => {
  try {
    await runQuery("DELETE FROM notifications WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete", error: error.message });
  }
};
