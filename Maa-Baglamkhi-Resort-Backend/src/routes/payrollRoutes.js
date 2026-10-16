const express = require("express");
const router = express.Router();
const ctrl = require("../controller/payrollController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const ADMIN = ["admin"];
const READERS = ["admin", "accountant"];

router.use(authMiddleware);

router.get("/payments", roleMiddleware(READERS), ctrl.listPayments);
router.post("/payments", roleMiddleware(ADMIN), ctrl.createPayment);
router.get("/payments/:id", roleMiddleware(READERS), ctrl.getPayment);
router.patch("/payments/:id", roleMiddleware(ADMIN), ctrl.updatePayment);
router.post("/payments/:id/mark-paid", roleMiddleware(ADMIN), ctrl.markPaid);
router.get("/estimate/:employeeId", roleMiddleware(READERS), ctrl.estimateSalary);

module.exports = router;
