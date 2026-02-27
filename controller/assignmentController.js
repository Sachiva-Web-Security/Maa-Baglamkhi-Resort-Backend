const db = require("../config/db");

// CREATE
exports.createAssignment = (req, res) => {
  const { staff_name, room_number, task, assigned_by } = req.body;

  if (!staff_name || !room_number || !task || !assigned_by) {
    return res.status(400).json({ message: "All fields required" });
  }

  const sql = `
    INSERT INTO assignments 
    (staff_name, room_number, task, assigned_by, status) 
    VALUES (?, ?, ?, ?, 'Pending')
  `;

  db.query(
    sql,
    [staff_name, room_number, task, assigned_by],
    (err, result) => {
      if (err) return res.status(500).json(err);

      const newTask = {
        id: result.insertId,
        staff_name,
        room_number,
        task,
        assigned_by,
        status: "Pending",
      };

      // 🔔 SOCKET NOTIFICATION
      if (global.io) {
        global.io.emit("newTask", newTask);
      }

      res.status(201).json(newTask);
    }
  );
};

// GET ALL
exports.getAssignments = (req, res) => {
  const { role, name } = req.query;

  let sql = "SELECT * FROM assignments";
  let values = [];

  if (role === "Staff") {
    sql += " WHERE staff_name = ?";
    values.push(name);
  }

  sql += " ORDER BY id DESC";

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

// UPDATE STATUS
exports.updateAssignment = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const sql = "UPDATE assignments SET status=? WHERE id=?";

  db.query(sql, [status, id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Updated successfully" });
  });
};

// DELETE
exports.deleteAssignment = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM assignments WHERE id=?";

  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted successfully" });
  });
};

// EDIT
exports.editAssignment = (req, res) => {
  const { id } = req.params;
  const { staff_name, room_number, task } = req.body;

  const sql = `
    UPDATE assignments 
    SET staff_name=?, room_number=?, task=? 
    WHERE id=?
  `;

  db.query(sql, [staff_name, room_number, task, id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Updated successfully" });
  });
};

// STATS
exports.getStats = (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) as pending
    FROM assignments
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
};