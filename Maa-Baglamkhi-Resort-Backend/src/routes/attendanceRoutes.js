const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const attendanceController = require("../controller/attendanceController");

// Self-service routes first so /me is not captured by the list handler.
router.get("/me", authMiddleware, attendanceController.getMyAttendance);
router.get("/me/salary", authMiddleware, attendanceController.calculateMySalary);

// Reads are open to any signed-in user; writes are admin-only.
router.get("/employees", authMiddleware, attendanceController.getEmployees);
router.get("/report", authMiddleware, attendanceController.getAttendanceReport);
router.get("/payroll", authMiddleware, attendanceController.getPayrollAttendance);
router.get("/", authMiddleware, attendanceController.getAllAttendance);

// Mark attendance for self or, with employeeId/userId in the body, anyone.
router.post("/", authMiddleware, roleMiddleware(["admin"]), attendanceController.markAttendance);
router.post("/mark", authMiddleware, roleMiddleware(["admin"]), attendanceController.markAttendance);

// Edit / delete a record.
router.put("/:id", authMiddleware, attendanceController.updateAttendanceRecord);
router.patch("/:id", authMiddleware, attendanceController.updateAttendanceRecord);
router.delete("/:id", authMiddleware, roleMiddleware(["admin"]), attendanceController.deleteAttendanceRecord);

module.exports = router;
