// models/NotificationModel.js
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });

const ensureSchema = async () => {
  await runQuery(`
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

const create = (payload) => {
  const sql = `
    INSERT INTO notifications (user_id, user_role, type, title, message, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  return runQuery(sql, [
    payload.user_id || null,
    payload.user_role || null,
    payload.type || "general",
    payload.title || "",
    payload.message || "",
    payload.data ? JSON.stringify(payload.data) : null,
  ]);
};

const list = (filters = {}) => {
  const userId = filters.user_id || 0;
  const role = String(filters.role || "").toLowerCase();
  const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
  const isAdmin = role === "admin";

  const sql = isAdmin
    ? `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200`
    : `SELECT * FROM notifications WHERE user_id = ? OR user_role IN (?) ORDER BY created_at DESC LIMIT 200`;

  if (isAdmin) {
    return runQuery(sql).then(rows => rows);
  }
  return runQuery(sql, [userId, visibleRoles]);
};

const markAsRead = (id, userId, role) => {
  const isAdmin = role === "admin";
  if (isAdmin) {
    return runQuery("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?", [id]);
  }
  const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
  return runQuery(
    "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND (user_id = ? OR user_role IN (?))",
    [id, userId, visibleRoles]
  );
};

const markAllAsRead = (userId, role) => {
  const isAdmin = role === "admin";
  if (isAdmin) {
    return runQuery("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE is_read = 0");
  }
  const visibleRoles = role === "chef" ? ["chef", "kitchen"] : [role];
  return runQuery(
    "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE is_read = 0 AND (user_id = ? OR user_role IN (?))",
    [userId, visibleRoles]
  );
};

const remove = (id) => runQuery("DELETE FROM notifications WHERE id = ?", [id]);

module.exports = {
  ensureSchema,
  create,
  list,
  markAsRead,
  markAllAsRead,
  remove,
};
