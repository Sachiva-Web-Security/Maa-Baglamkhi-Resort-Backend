const SalaryModel = require("../models/SalaryModel");
const AttendanceModel = require("../models/AttendanceModel");
const db = require("../config/db");

/**
 * ADMIN: Set or update salary + designation for an employee.
 * POST /api/salary/:userId
 * body: { salary, designation }
 */
exports.setEmployeeSalary = async (req, res) => {
  try {
    const { userId } = req.params;
    const { salary, designation } = req.body || {};

    if (!userId || salary === undefined || salary === null) {
      return res.status(400).json({ message: "userId and salary required" });
    }

    if (parseFloat(salary) < 0) {
      return res.status(400).json({ message: "Salary must be >= 0" });
    }

    const result = await SalaryModel.setSalary(userId, salary, designation);
    const updatedUser = await SalaryModel.getSalaryByUserId(userId);

    return res.json({ message: "Salary saved", user: updatedUser, ...result });
  } catch (err) {
    console.error("setEmployeeSalary error:", err);
    if (err.message === "User not found") {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(500).json({ message: "Failed to set salary", error: err.message });
  }
};

/**
 * ADMIN: Get all employees with their salaries.
 * GET /api/salary
 */
exports.getAllEmployeesWithSalary = async (req, res) => {
  try {
    const users = await SalaryModel.getAllSalaries();
    return res.json(users);
  } catch (err) {
    console.error("getAllEmployeesWithSalary error:", err);
    return res.status(500).json({ message: "Failed to fetch salaries" });
  }
};

/**
 * ADMIN or SELF: Get salary of a user.
 * GET /api/salary/:userId
 *
 * If the requester is non-admin, only their own record is allowed.
 */
exports.getEmployeeSalary = async (req, res) => {
  try {
    const { userId } = req.params;
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Non-admin users may only see their own salary.
    if (requester.role !== "admin" && Number(requester.id) !== Number(userId)) {
      return res.status(403).json({ message: "Forbidden: can only view your own salary" });
    }

    const user = await SalaryModel.getSalaryByUserId(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    console.error("getEmployeeSalary error:", err);
    return res.status(500).json({ message: "Failed to fetch salary" });
  }
};

/**
 * SELF: Get the currently logged-in user's salary + designation.
 * GET /api/salary/me
 */
exports.getMySalary = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const user = await SalaryModel.getSalaryByUserId(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(user);
  } catch (err) {
    console.error("getMySalary error:", err);
    return res.status(500).json({ message: "Failed to fetch salary" });
  }
};

/**
 * Get my attendance + calculated salary (logged-in user).
 * GET /api/salary/me/attendance?month=YYYY-MM
 */
exports.getMyAttendanceWithSalary = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    let year, month;
    if (req.query.month) {
      const [y, m] = req.query.month.split("-").map(Number);
      year = y;
      month = m;
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const data = await SalaryModel.getMonthlySalarySummary(id, year, month);
    return res.json(data);
  } catch (err) {
    console.error("getMyAttendanceWithSalary error:", err);
    return res.status(500).json({ message: "Failed to fetch attendance" });
  }
};

/**
 * ADMIN: Recalculate salary_amount for all attendance records of an employee
 * based on their stored salary and current status.
 * POST /api/salary/:userId/recalculate
 */
exports.recalculateAttendance = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await SalaryModel.getSalaryByUserId(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const records = await SalaryModel.getAttendanceByUserId(userId);

    const updates = await Promise.all(
      records.map(async (r) => {
        const [year, month] = r.date.toString().split("-").map(Number);
        const amount = SalaryModel.calculateDaySalary(user.salary, r.status, year, month);
        await SalaryModel.updateAttendanceSalary(r.id, amount);
        return { id: r.id, amount };
      })
    );

    return res.json({ message: "Attendance recalculated", updates });
  } catch (err) {
    console.error("recalculateAttendance error:", err);
    return res.status(500).json({ message: "Failed to recalculate" });
  }
};
/**
 * ADMIN: List salary payment records with optional filters.
 * GET /api/salary/payments?userId=&year=&month=
 */
exports.listSalaryPayments = async (req, res) => {
  try {
    const { userId, year, month } = req.query;
    const filters = {};
    if (userId) filters.userId = Number(userId);
    if (year) filters.year = Number(year);
    if (month) filters.month = Number(month);
    const rows = await SalaryModel.getSalaryPayments(filters);
    return res.json(rows);
  } catch (err) {
    console.error("listSalaryPayments error:", err);
    return res.status(500).json({ message: "Failed to fetch payments" });
  }
};

/**
 * ADMIN: Get month summary for a specific employee.
 * GET /api/salary/:userId/month-summary?year=&month=
 */
exports.getEmployeeMonthSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    const year = Number(req.query.year || now.getFullYear());
    const month = Number(req.query.month || now.getMonth() + 1);
    const data = await SalaryModel.getEmployeeMonthSummary(Number(userId), year, month);
    return res.json(data);
  } catch (err) {
    console.error("getEmployeeMonthSummary error:", err);
    return res.status(500).json({ message: "Failed to fetch month summary" });
  }
};

/**
 * ADMIN: Mark salary as paid / update payment status.
 * POST /api/salary/:userId/pay
 * body: { year, month, status, amount_paid, payment_mode, paid_on, notes }
 */
exports.markSalaryPaid = async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, month, status, amount_paid, payment_mode, paid_on, notes } = req.body || {};
    if (!userId || !year || !month) {
      return res.status(400).json({ message: "userId, year and month are required" });
    }
    const result = await SalaryModel.upsertSalaryPayment({
      userId: Number(userId),
      year: Number(year),
      month: Number(month),
      status: status || "Paid",
      amountPaid: amount_paid ?? 0,
      paymentMode: payment_mode || null,
      paidOn: paid_on || new Date().toISOString().slice(0, 10),
      notes: notes || null,
      createdBy: req.user?.id || null,
    });
    const record = await SalaryModel.getSalaryPayment(Number(userId), Number(year), Number(month));
    return res.json({ message: "Salary payment updated", record });
  } catch (err) {
    console.error("markSalaryPaid error:", err);
    return res.status(500).json({ message: "Failed to update payment" });
  }
};

/**
 * ADMIN: Get payment history for an employee.
 * GET /api/salary/:userId/payment-history
 */
exports.getSalaryPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const rows = await SalaryModel.getSalaryPaymentHistory(Number(userId));
    return res.json(rows);
  } catch (err) {
    console.error("getSalaryPaymentHistory error:", err);
    return res.status(500).json({ message: "Failed to fetch history" });
  }
};
