const router = require("express").Router();
const salaryController = require("../controller/salaryController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Admin-only: Set salary for any employee
router.post("/:userId", authMiddleware, roleMiddleware(["admin"]), salaryController.setEmployeeSalary);

// Admin-only: List all employees with salary info
router.get("/", authMiddleware, roleMiddleware(["admin"]), salaryController.getAllEmployeesWithSalary);

// Admin or self: Get salary of a specific user
router.get("/:userId", authMiddleware, salaryController.getEmployeeSalary);

// Self: Get my salary
router.get("/me", authMiddleware, salaryController.getMySalary);

// Self: Get my attendance with calculated salary
router.get("/me/attendance", authMiddleware, salaryController.getMyAttendanceWithSalary);

// Admin: Recalculate attendance salary for a user
router.post("/:userId/recalculate", authMiddleware, roleMiddleware(["admin"]), salaryController.recalculateAttendance);

module.exports = router;
