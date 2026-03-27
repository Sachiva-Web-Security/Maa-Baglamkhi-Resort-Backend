const db = require("../config/db");

const query = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

exports.getAll = async (req, res) => {
  try {
    const results = await query(
      "SELECT * FROM assignments ORDER BY FIELD(priority,'Urgent','High','Normal','Low'), created_at DESC"
    );
    res.json(results);
  } catch {
    try {
      const results = await query("SELECT * FROM assignments ORDER BY created_at DESC");
      res.json(results);
    } catch (err2) {
      res.status(500).json({ message: "Database error", error: err2 });
    }
  }
};

exports.getStats = async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN LOWER(COALESCE(status, 'pending')) = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN LOWER(COALESCE(status, 'pending')) <> 'completed' THEN 1 ELSE 0 END) AS pending
      FROM assignments
    `);

    const stats = rows[0] || {};
    res.json({
      total: Number(stats.total || 0),
      completed: Number(stats.completed || 0),
      pending: Number(stats.pending || 0),
    });
  } catch (err) {
    res.status(500).json({ message: "Stats fetch failed", error: err });
  }
};

exports.create = async (req, res) => {
  const {
    staffName,
    staff_name,
    roomNumber,
    room_number,
    task,
    priority,
    assignedBy,
    assigned_by,
    dueTime,
    due_time,
    notes,
  } = req.body;
  try {
    const result = await query(
      `INSERT INTO assignments (staff_name, room_number, task, priority, assigned_by, due_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        staffName || staff_name,
        roomNumber || room_number || null,
        task,
        priority || "Normal",
        assignedBy || assigned_by || null,
        dueTime || due_time || null,
        notes || null,
      ]
    );
    res.json({ message: "Assignment created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const {
    status,
    priority,
    task,
    staffName,
    staff_name,
    roomNumber,
    room_number,
    dueTime,
    due_time,
    notes,
  } = req.body;
  const fields = [], values = [];
  if (status !== undefined)     { fields.push("status = ?");      values.push(status); }
  if (priority !== undefined)   { fields.push("priority = ?");    values.push(priority); }
  if (task !== undefined)       { fields.push("task = ?");        values.push(task); }
  if (staffName !== undefined || staff_name !== undefined)  { fields.push("staff_name = ?");  values.push(staffName ?? staff_name); }
  if (roomNumber !== undefined || room_number !== undefined) { fields.push("room_number = ?"); values.push(roomNumber ?? room_number); }
  if (dueTime !== undefined || due_time !== undefined)    { fields.push("due_time = ?");    values.push(dueTime ?? due_time); }
  if (notes !== undefined)      { fields.push("notes = ?");       values.push(notes); }
  if (!fields.length) return res.status(400).json({ message: "No fields to update" });
  values.push(id);
  try {
    await query(`UPDATE assignments SET ${fields.join(", ")} WHERE id = ?`, values);
    res.json({ message: "Assignment updated" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err });
  }
};

exports.remove = async (req, res) => {
  try {
    await query("DELETE FROM assignments WHERE id = ?", [req.params.id]);
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err });
  }
};
