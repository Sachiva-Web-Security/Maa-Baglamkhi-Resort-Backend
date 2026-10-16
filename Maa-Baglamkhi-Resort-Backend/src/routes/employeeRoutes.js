const express = require("express");
const router = express.Router();
const ctrl = require("../controller/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const ADMIN = ["admin"];
const READERS = ["admin", "manager", "accountant"];
// The attendance grid shows every staff member's day, so it needs the roster
// for any signed-in role, not just the payroll readers.
const ALL_AUTHED = ["admin", "manager", "reception", "accounts", "housekeeping", "waiter", "kitchen", "staff"];

router.use(authMiddleware);

// Static lookups must be registered before the /:id route.
router.get("/departments", roleMiddleware(READERS), ctrl.listDepartments);
router.get("/designations", roleMiddleware(READERS), ctrl.listDesignations);
router.get("/stats", roleMiddleware(READERS), ctrl.getEmployeeStats);
router.get("/attendance/employees", roleMiddleware(ALL_AUTHED), ctrl.listEmployees);
router.get("/employees", roleMiddleware(ALL_AUTHED), ctrl.listEmployees);

router.get("/", roleMiddleware(READERS), ctrl.listEmployees);
router.post("/", roleMiddleware(ADMIN), ctrl.createEmployee);
router.get("/:id", roleMiddleware(READERS), ctrl.getEmployee);
router.put("/:id", roleMiddleware(ADMIN), ctrl.updateEmployee);
router.patch("/:id", roleMiddleware(ADMIN), ctrl.updateEmployee);
router.delete("/:id", roleMiddleware(ADMIN), ctrl.deactivateEmployee);

module.exports = router;
