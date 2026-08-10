const db = require("../config/db");

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

/**
 * Ensure the notifications table exists. Called lazily on first hit so the
 * frontend can keep using the API even on a fresh database.
 */
exports.ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      user_role VARCHAR(50),
      type VARCHAR(100),
      title VARCHAR(255),
      message TEXT,
      data JSON,
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_read (user_id, is_read),
      INDEX idx_role_read (user_role, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

/**
 * Notifications are visible to:
 *   - the user whose user_id matches
 *   - everyone whose user_role matches (role-wide announcements)
 *   - admins always see everything
 */
exports.listNotifications = async (req, res) => {
  try {
    await exports.ensureSchema();

    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
    const isAdmin = role === "admin";

    const rows = await query(
      `
        SELECT id, user_id, user_role, type, title, message, data,
               is_read, created_at, read_at
        FROM notifications
        ${isAdmin ? "" : "WHERE user_id = ? OR user_role IN (?)"}
        ORDER BY created_at DESC
        LIMIT 200
      `,
      isAdmin ? [] : [userId, visibleRoles],
    );

    res.json(rows);
  } catch (error) {
    console.error("listNotifications error:", error.message);
    res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await exports.ensureSchema();
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
    const isAdmin = role === "admin";

    if (isAdmin) {
      await query("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?", [
        req.params.id,
      ]);
    } else {
      await query(
        "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND (user_id = ? OR user_role IN (?))",
        [req.params.id, userId, visibleRoles],
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark as read", error: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await exports.ensureSchema();
    const userId = req.user?.id || 0;
    const role = String(req.user?.role || "").toLowerCase();
    const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
    const isAdmin = role === "admin";

    if (isAdmin) {
      await query("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE is_read = 0");
    } else {
      await query(
        "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE is_read = 0 AND (user_id = ? OR user_role IN (?))",
        [userId, visibleRoles],
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark all as read", error: error.message });
  }
};

const _createNotification = async (payload) => {
  await exports.ensureSchema();
  const { user_id, user_role, type, title, message, data } = payload || {};

  if (!title && !message) {
    throw new Error("title or message is required");
  }

  return query(
    `INSERT INTO notifications (user_id, user_role, type, title, message, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      user_id || null,
      user_role || null,
      type || "general",
      title || "",
      message || "",
      data ? JSON.stringify(data) : null,
    ],
  );
};

exports.createNotification = async (req, res) => {
  try {
    const result = await _createNotification(req.body || {});
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Failed to create notification", error: error.message });
  }
};

// Exported so other controllers (e.g. kitchenController) can call this
// directly with a plain payload object, without going through req/res.
exports._createNotification = _createNotification;

exports.deleteNotification = async (req, res) => {
  try {
    await exports.ensureSchema();
    await query("DELETE FROM notifications WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete", error: error.message });
  }
};