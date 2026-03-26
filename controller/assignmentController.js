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

exports.create = async (req, res) => {
  const { staffName, roomNumber, task, priority, assignedBy, dueTime, notes } = req.body;
  try {
    const result = await query(
      `INSERT INTO assignments (staff_name, room_number, task, priority, assigned_by, due_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [staffName, roomNumber || null, task, priority || "Normal", assignedBy || null, dueTime || null, notes || null]
    );
    res.json({ message: "Assignment created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { status, priority, task, staffName, roomNumber, dueTime, notes } = req.body;
  const fields = [], values = [];
  if (status !== undefined)     { fields.push("status = ?");      values.push(status); }
  if (priority !== undefined)   { fields.push("priority = ?");    values.push(priority); }
  if (task !== undefined)       { fields.push("task = ?");        values.push(task); }
  if (staffName !== undefined)  { fields.push("staff_name = ?");  values.push(staffName); }
  if (roomNumber !== undefined) { fields.push("room_number = ?"); values.push(roomNumber); }
  if (dueTime !== undefined)    { fields.push("due_time = ?");    values.push(dueTime); }
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
