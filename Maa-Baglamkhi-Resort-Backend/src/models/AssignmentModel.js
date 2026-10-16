// models/AssignmentModel.js
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
    CREATE TABLE IF NOT EXISTS assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_name VARCHAR(191) NOT NULL,
      room_number VARCHAR(50) DEFAULT NULL,
      task VARCHAR(255) NOT NULL,
      priority VARCHAR(50) DEFAULT 'Normal',
      assigned_by VARCHAR(191) DEFAULT NULL,
      due_time DATETIME DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const cols = await runQuery("SHOW COLUMNS FROM assignments LIKE 'updated_at'");
  if (!Array.isArray(cols) || cols.length === 0) {
    await runQuery(
      "ALTER TABLE assignments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );
  }
};

const create = (data) => {
  const sql = `
    INSERT INTO assignments (staff_name, room_number, task, priority, assigned_by, due_time, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  return runQuery(sql, [
    data.staff_name || "",
    data.room_number || null,
    data.task || "",
    data.priority || "Normal",
    data.assigned_by || null,
    data.due_time || null,
    data.notes || null,
    data.status || "Pending",
  ]);
};

const update = (id, data) => {
  const sets = [];
  const values = [];
  const fields = ["staff_name", "room_number", "task", "priority", "assigned_by", "due_time", "notes", "status"];
  for (const field of fields) {
    if (data[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(data[field]);
    }
  }
  if (!sets.length) return runQuery("SELECT * FROM assignments WHERE id = ?", [id]);
  values.push(id);
  return runQuery(`UPDATE assignments SET ${sets.join(", ")} WHERE id = ?`, values);
};

const updateStatus = (id, status) => {
  return runQuery("UPDATE assignments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, id]);
};

const remove = (id) => runQuery("DELETE FROM assignments WHERE id = ?", [id]);

const getAll = (options = {}) => {
  let sql = "SELECT * FROM assignments";
  const params = [];
  const conditions = [];

  if (options.staffName) {
    conditions.push("staff_name = ?");
    params.push(options.staffName);
  }
  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }
  if (options.roomNumber) {
    conditions.push("room_number = ?");
    params.push(options.roomNumber);
  }

  if (conditions.length) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY FIELD(priority,'Urgent','High','Normal','Low'), created_at DESC";
  return runQuery(sql, params);
};

const getStats = () => {
  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
    FROM assignments
  `;
  return runQuery(sql);
};

module.exports = {
  ensureSchema,
  create,
  update,
  updateStatus,
  remove,
  getAll,
  getStats,
};
