const AttendanceModel = require("../models/AttendanceModel");

exports.getForDate = (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date query required" });

  AttendanceModel.getByDate(date, (err, rows) => {
    if (err) {
      console.error("Error fetching attendance:", err);
      return res.status(500).json({ message: "Error fetching attendance" });
    }
    res.json(rows);
  });
};

exports.createManual = (req, res) => {
  const data = req.body;
  if (!data.date || !data.name || !data.role || !data.department || !data.status) {
    return res.status(400).json({ message: "Missing fields" });
  }
  AttendanceModel.createRecord(data, (err, result) => {
    if (err) {
      console.error("Error creating attendance:", err);
      return res.status(500).json({ message: "Error creating record" });
    }
    res.json({ message: "Attendance saved", id: result.insertId });
  });
};

