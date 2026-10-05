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

  const db = require("../config/db");

  // v4: attendance is keyed by employee_id (employees.id), while requests carry
  // a user id. Resolve this user's employee row, then return only their records.
  db.query("SELECT id FROM employees WHERE user_id = ? LIMIT 1", [userId])
    .then(([employeeRows]) => {
      const employee = employeeRows && employeeRows[0];
      // No linked employee row is a valid state: return an empty, well-formed list.
      if (!employee) {
        return res.json([]);
      }
      return db
        .query(
          "SELECT * FROM attendance_records WHERE employee_id = ? ORDER BY date DESC",
          [employee.id]
        )
        .then(([rows]) => res.json(rows || []));
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
