const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const attendanceController = require("../controller/attendanceController");

router.get("/", authMiddleware, (req, res, next) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date query required" });

  const userRole = req.user?.role;
  const userId = req.user?.id;

  if (userRole === "admin") {
    return attendanceController.getAllAttendance(req, res, next);
  }

  const AttendanceRecordsModel = require("../models/AttendanceRecordsModel");
  const UsersModel = require("../models/UsersModel");

  Promise.all([
    UsersModel.findById(userId).then((rows) => rows[0] || null),
    AttendanceRecordsModel.findAll().then((rows) => rows || []),
  ])
    .then(([user, rows]) => {
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const myRecords = rows.filter((r) => r.employee_name === user.name || r.user_id === userId);
      res.json(myRecords);
    })
    .catch(() => res.status(500).json({ message: "Error fetching attendance" }));
});

/**
 * POST /api/attendance
 * Admin only: create attendance record for any employee.
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["admin"]),
  attendanceController.markMyAttendance
);

module.exports = router;
