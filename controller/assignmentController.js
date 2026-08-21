const db = require("../config/db");
const {
  getRequestActor,
  namesMatch,
} = require("../utils/requestActor");

const query = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

const ASSIGNEE_ROLES = new Set(["housekeeping", "accountant", "staff"]);
const MANAGER_ROLES = new Set(["admin", "manager", "receptionist"]);

const isAssigneeRole = (role) => ASSIGNEE_ROLES.has(String(role || "").toLowerCase());
const isManagerRole = (role) => MANAGER_ROLES.has(String(role || "").toLowerCase());

const getVisibilityContext = (req) => {
  const actor = getRequestActor(req);

  return {
    actor,
    restrictToOwnAssignments: isAssigneeRole(actor.role) && actor.normalizedName,
  };
};

const ensureColumn = async (tableName, columnName, definition) => {
  const rows = await query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (!Array.isArray(rows) || rows.length === 0) {
    await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureSchema = async () => {
  await query(`
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

  await ensureColumn(
    "assignments",
    "updated_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
};

exports.bootstrap = async (_req, _res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (error) {
    next(error);
  }
};

/* ── GET ALL (with role-based filtering) ───────────────────────── */
exports.getAll = async (req, res) => {
  const { actor, restrictToOwnAssignments } = getVisibilityContext(req);

  try {
    let sql, params;

    if (restrictToOwnAssignments) {
      sql = `
        SELECT * FROM assignments
        WHERE staff_name = ?
        ORDER BY FIELD(priority,'Urgent','High','Normal','Low'), created_at DESC
      `;
      params = [actor.name];
    } else {
      sql = `
        SELECT * FROM assignments
        ORDER BY FIELD(priority,'Urgent','High','Normal','Low'), created_at DESC
      `;
      params = [];
    }

    const results = await query(sql, params);
    res.json(results);
  } catch (err) {
    // Fallback if FIELD() not available
    try {
      const results = await query("SELECT * FROM assignments ORDER BY created_at DESC");
      res.json(results);
    } catch (err2) {
      res.status(500).json({ message: "Database error", error: err2 });
    }
  }
};

/* ── GET STATS ─────────────────────────────────────────────────── */
exports.getStats = async (req, res) => {
  const { actor, restrictToOwnAssignments } = getVisibilityContext(req);
  try {
    let sql, params;

    if (restrictToOwnAssignments) {
      sql = `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'in progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(
            CASE
              WHEN due_time IS NOT NULL
               AND due_time < NOW()
               AND LOWER(COALESCE(status,'pending')) NOT IN ('completed', 'cancelled')
              THEN 1 ELSE 0
            END
          ) AS overdue
        FROM assignments
        WHERE staff_name = ?
      `;
      params = [actor.name];
    } else {
      sql = `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'in progress' THEN 1 ELSE 0 END) AS in_progress,
          SUM(CASE WHEN LOWER(COALESCE(status,'pending')) = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(
            CASE
              WHEN due_time IS NOT NULL
               AND due_time < NOW()
               AND LOWER(COALESCE(status,'pending')) NOT IN ('completed', 'cancelled')
              THEN 1 ELSE 0
            END
          ) AS overdue
        FROM assignments
      `;
      params = [];
    }

    const rows  = await query(sql, params);
    const stats = rows[0] || {};
    res.json({
      total:     Number(stats.total     || 0),
      completed: Number(stats.completed || 0),
      inProgress: Number(stats.in_progress || 0),
      pending:   Number(stats.pending   || 0),
      overdue: Number(stats.overdue || 0),
    });
  } catch (err) {
    res.status(500).json({ message: "Stats fetch failed", error: err });
  }
};

/* ── CREATE ────────────────────────────────────────────────────── */
exports.create = async (req, res) => {
  const {
    staffName, staff_name,
    roomNumber, room_number,
    task,
    priority,
    assignedBy, assigned_by,
    dueTime, due_time,
    notes,
  } = req.body;

  if (!task) return res.status(400).json({ message: "task is required" });

  try {
    const result = await query(
      `INSERT INTO assignments (staff_name, room_number, task, priority, assigned_by, due_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        staffName  || staff_name  || null,
        roomNumber || room_number || null,
        task,
        priority   || "Normal",
        assignedBy || assigned_by || null,
        dueTime    || due_time    || null,
        notes      || null,
      ]
    );
    res.json({ message: "Assignment created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

/* ── UPDATE ────────────────────────────────────────────────────── */
exports.update = async (req, res) => {
  const { id } = req.params;
  const actor = getRequestActor(req);
  const {
    status, priority, task,
    staffName, staff_name,
    roomNumber, room_number,
    dueTime, due_time,
    notes,
  } = req.body;

  const fields = [], values = [];

  if (status    !== undefined) { fields.push("status = ?");      values.push(status); }
  if (priority  !== undefined) { fields.push("priority = ?");    values.push(priority); }
  if (task      !== undefined) { fields.push("task = ?");        values.push(task); }
  if (staffName !== undefined || staff_name !== undefined)
    { fields.push("staff_name = ?");  values.push(staffName ?? staff_name); }
  if (roomNumber !== undefined || room_number !== undefined)
    { fields.push("room_number = ?"); values.push(roomNumber ?? room_number); }
  if (dueTime !== undefined || due_time !== undefined)
    { fields.push("due_time = ?");    values.push(dueTime ?? due_time); }
  if (notes !== undefined) { fields.push("notes = ?"); values.push(notes); }

  if (!fields.length) return res.status(400).json({ message: "No fields to update" });

  try {
    const rows = await query("SELECT * FROM assignments WHERE id = ? LIMIT 1", [id]);
    const existingAssignment = rows[0];

    if (!existingAssignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (isAssigneeRole(actor.role) && !isManagerRole(actor.role)) {
      const isOwnAssignment = namesMatch(existingAssignment.staff_name, actor.name);
      const requestedFields = Object.keys(req.body || {});
      const statusOnlyUpdate =
        requestedFields.length === 1 &&
        Object.prototype.hasOwnProperty.call(req.body || {}, "status");

      if (!isOwnAssignment) {
        return res.status(403).json({ message: "You can only update your own assignments" });
      }

      if (!statusOnlyUpdate) {
        return res.status(403).json({ message: "You can only update assignment status" });
      }
    }

    values.push(id);
    await query(`UPDATE assignments SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ message: "Assignment updated" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err });
  }
};

/* ── DELETE ────────────────────────────────────────────────────── */
exports.remove = async (req, res) => {
  try {
    await query("DELETE FROM assignments WHERE id = ?", [req.params.id]);
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err });
  }
};

exports.updateStatus = async (req, res) => exports.update(req, res);
