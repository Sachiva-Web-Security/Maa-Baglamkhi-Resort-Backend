const db = require("../config/db");
const HousekeepingAssignmentsModel = require("../models/HousekeepingAssignmentsModel");
const { getRequestActor } = require("../utils/requestActor");

const query = async (sql, params = []) => {
  try {
    const [rows] = await db.query(sql, params);
    return rows;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw err;
  }
};

exports.bootstrap = async (_req, _res, next) => {
  try {
    await HousekeepingAssignmentsModel.ensureSchema();
    next();
  } catch (error) {
    next(error);
  }
};

const getVisibilityContext = (req) => {
  const actor = getRequestActor(req);
  const ASSIGNEE_ROLES = new Set(["housekeeping", "accountant", "staff"]);
  return {
    actor,
    restrictToOwnAssignments: ASSIGNEE_ROLES.has(String(actor.role || "").toLowerCase()) && actor.normalizedName,
  };
};

const isAssigneeRole = (role) => ["housekeeping", "accountant", "staff"].includes(String(role || "").toLowerCase());
const isManagerRole = (role) => ["admin", "manager", "receptionist"].includes(String(role || "").toLowerCase());

// Loose name comparison: housekeeping staff are matched by display name, which
// may differ in case, order, or spacing between the assignment and the session.
const normalizeName = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const namesMatch = (a, b) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // "Ravi Sharma" vs "Ravi Kumar Sharma" — one name contains the other
  return left.includes(right) || right.includes(left);
};

/* ── GET ALL (with role-based filtering) ───────────────────────── */
exports.getAll = async (req, res) => {
  const { actor, restrictToOwnAssignments } = getVisibilityContext(req);

  try {
    let sql, params;

    if (restrictToOwnAssignments) {
      sql = `
        SELECT * FROM housekeeping_assignments
        WHERE assigned_to_name = ?
        ORDER BY FIELD(priority,'urgent','high','normal','low'), created_at DESC
      `;
      params = [actor.name];
    } else {
      sql = `
        SELECT * FROM housekeeping_assignments
        ORDER BY FIELD(priority,'urgent','high','normal','low'), created_at DESC
      `;
      params = [];
    }

    const results = await query(sql, params);
    res.json(results);
  } catch (err) {
    // Fallback if FIELD() not available
    try {
      const results = await query("SELECT * FROM housekeeping_assignments ORDER BY created_at DESC");
      res.json(results);
    } catch (err2) {
      res.status(500).json({ message: "Database error", error: err2 });
    }
  }
};

/* ── GET STATS ─────────────────────────────────────────────────── */
// v4 columns: status enum is pending/in_progress/completed/verified/cancelled.
// Overdue = started_at is past AND not yet completed/verified/cancelled.
exports.getStats = async (req, res) => {
  const { actor, restrictToOwnAssignments } = getVisibilityContext(req);
  try {
    const base = "COUNT(*) AS total, SUM(status='completed') AS completed, SUM(status='in_progress') AS in_progress, SUM(status='pending') AS pending";
    let sql, params;

    if (restrictToOwnAssignments) {
      sql = `
        SELECT ${base},
          SUM(
            started_at IS NOT NULL
            AND started_at < NOW()
            AND status NOT IN ('completed','verified','cancelled')
          ) AS overdue
        FROM housekeeping_assignments
        WHERE assigned_to_name = ?
      `;
      params = [actor.name];
    } else {
      sql = `SELECT ${base}, SUM(started_at IS NOT NULL AND started_at < NOW() AND status NOT IN ('completed','verified','cancelled')) AS overdue FROM housekeeping_assignments`;
      params = [];
    }

    const rows = await query(sql, params);
    const stats = rows[0] || {};
    res.json({
      total:       Number(stats.total       || 0),
      completed:   Number(stats.completed   || 0),
      inProgress:  Number(stats.in_progress || 0),
      pending:     Number(stats.pending     || 0),
      overdue:     Number(stats.overdue    || 0),
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
    notes,
    dueTime, due_time,
    assignedBy,
  } = req.body;

  if (!task) return res.status(400).json({ message: "task is required" });

  // The v4 table (housekeeping_assignments) has room_id NOT NULL, an enum
  // task_type and an enum priority. Resolve the room by number first, and
  // normalise the free-text task/priority the API accepts onto the enums.
  const rn = String(roomNumber || room_number || "").trim();
  if (!rn) {
    return res.status(400).json({ message: "roomNumber is required" });
  }

  const roomLookup = await query(
    "SELECT id FROM rooms WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR) LIMIT 1",
    [rn]
  );
  const roomId = roomLookup?.[0]?.id ?? null;
  if (!roomId) {
    return res.status(400).json({
      message: `Room '${rn}' is not in the room inventory. Add it to Rooms before creating an assignment.`,
    });
  }

  const priorityMap = {
    urgent: "urgent",
    high: "high",
    normal: "normal",
    low: "low",
    medium: "normal",
    critical: "urgent",
  };
  const taskTypeMap = {
    cleaning: "cleaning",
    "deep clean": "deep_clean",
    deepclean: "deep_clean",
    deep_clean: "deep_clean",
    inspection: "inspection",
    setup: "setup",
    maintenance: "maintenance",
    other: "other",
  };

  const normalizedPriority = priorityMap[String(priority || "Normal").toLowerCase()] || "normal";
  const normalizedTaskType = taskTypeMap[String(task).toLowerCase().trim()] || "other";
  const dueTimeValue = (dueTime || due_time || "").trim() || null;
  const assignedByName = (assignedBy || "").trim() || null;

  try {
    // query() returns rows-only, so insertId has to come from db.query.
    const [result] = await db.query(
      `INSERT INTO housekeeping_assignments
         (room_id, room_number, assigned_to, assigned_to_name, task_type, priority, notes, status, due_time, assigned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        roomId,
        roomNumber || room_number || "",
        null,
        staffName || staff_name || null,
        normalizedTaskType,
        normalizedPriority,
        notes || null,
        dueTimeValue,
        assignedByName,
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
    notes,
    dueTime, due_time,
    assignedBy,
  } = req.body;

  // Only real columns of housekeeping_assignments. The old controller also
  // wrote `task`, `staff_name` and `due_time`, none of which exist in v4.
  const STATUS_MAP = {
    pending: "pending",
    "in progress": "in_progress",
    inprogress: "in_progress",
    in_progress: "in_progress",
    started: "in_progress",
    completed: "completed",
    done: "completed",
    verified: "verified",
    cancelled: "cancelled",
    canceled: "cancelled",
  };
  const PRIORITY_MAP = {
    urgent: "urgent", high: "high", normal: "normal",
    low: "low", medium: "normal", critical: "urgent",
  };
  const TASK_TYPE_MAP = {
    cleaning: "cleaning", "deep clean": "deep_clean", deepclean: "deep_clean",
    deep_clean: "deep_clean", inspection: "inspection", setup: "setup",
    maintenance: "maintenance", other: "other",
  };

  const fields = [], values = [];

  if (status !== undefined) {
    fields.push("status = ?");
    values.push(STATUS_MAP[String(status).toLowerCase()] || "pending");
    // Keep the operational timestamps honest without making the caller send them.
    if ((STATUS_MAP[String(status).toLowerCase()]) === "in_progress") {
      fields.push("started_at = NOW()");
    }
    if ((STATUS_MAP[String(status).toLowerCase()]) === "completed") {
      fields.push("completed_at = NOW()");
    }
  }
  if (priority !== undefined) {
    fields.push("priority = ?");
    values.push(PRIORITY_MAP[String(priority).toLowerCase()] || "normal");
  }
  if (task !== undefined) {
    fields.push("task_type = ?");
    values.push(TASK_TYPE_MAP[String(task).toLowerCase().trim()] || "other");
  }
  if (staffName !== undefined || staff_name !== undefined) {
    fields.push("assigned_to_name = ?");
    values.push(staffName ?? staff_name);
  }
  if (roomNumber !== undefined || room_number !== undefined) {
    fields.push("room_number = ?");
    values.push(roomNumber ?? room_number);
  }
  if (notes !== undefined) { fields.push("notes = ?"); values.push(notes); }
  if (dueTime !== undefined || due_time !== undefined) {
    fields.push("due_time = ?");
    values.push((dueTime ?? due_time ?? "").trim() || null);
  }
  if (assignedBy !== undefined) { fields.push("assigned_by = ?"); values.push(assignedBy || null); }

  if (!fields.length) return res.status(400).json({ message: "No fields to update" });

  try {
    const rows = await query("SELECT * FROM housekeeping_assignments WHERE id = ? LIMIT 1", [id]);
    const existingAssignment = rows[0];

    if (!existingAssignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    if (isAssigneeRole(actor.role) && !isManagerRole(actor.role)) {
      const isOwnAssignment = namesMatch(existingAssignment.assigned_to_name, actor.name);
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
    await query(`UPDATE housekeeping_assignments SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ message: "Assignment updated" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err });
  }
};

/* ── DELETE ────────────────────────────────────────────────────── */
exports.remove = async (req, res) => {
  try {
    await query("DELETE FROM housekeeping_assignments WHERE id = ?", [req.params.id]);
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err });
  }
};

exports.updateStatus = async (req, res) => exports.update(req, res);
