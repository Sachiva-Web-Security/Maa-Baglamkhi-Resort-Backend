const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const attendanceController = require("../controller/attendanceController");

/**
 * GET /api/attendance
 * Admin: gets ALL attendance records for the requested date.
 * Non-admin: gets ONLY their own attendance records.
 */
router.get("/", authMiddleware, (req, res, next) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date query required" });

  const userRole = req.user?.role;
  const userId = req.user?.id;

  if (userRole === "admin") {
    // Admin sees all employees
    return attendanceController.getForDate(req, res, next);
  }

  // Non-admin: only own records
  // We need to load the actual attendance records and filter by user_id
  const AttendanceModel = require("../models/AttendanceModel");
  const UserModel = require("../models/UserModel");

  // Get user's name so we can match attendance records
  UserModel.findUserById(userId, (userErr, userRows) => {
    if (userErr || !userRows || userRows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }
    const userName = userRows[0].name;

    AttendanceModel.getByDate(date, (attErr, rows) => {
      if (attErr) {
        return res.status(500).json({ message: "Error fetching attendance" });
      }
      // Filter to only this user's records
      const myRecords = rows.filter(r => r.name === userName || r.user_id === userId);
      res.json(myRecords);
    });
  });
});

/**
 * POST /api/attendance
 * Admin only: create attendance record for any employee.
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["admin"]),
  attendanceController.createManual
);

module.exports = router;
