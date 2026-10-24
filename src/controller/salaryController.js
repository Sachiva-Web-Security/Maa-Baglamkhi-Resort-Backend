const db = require("../config/db");
const SalaryPaymentsModel = require("../models/SalaryPaymentsModel");
const AttendanceRecordsModel = require("../models/AttendanceRecordsModel");

const DAY_STATUS_MULTIPLIER = {
  present: 1,
  absent: 0,
  late: 0.5,
  half_day: 0.5,
  on_leave: 0,
  holiday: 1,
  week_off: 1,
};

const calculateDaySalary = (monthlySalary, status, year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const daily = Number(monthlySalary || 0) / daysInMonth;
  const multiplier = DAY_STATUS_MULTIPLIER[String(status || "").toLowerCase()] || 0;
  return Number((daily * multiplier).toFixed(2));
};

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

    const [updatedUser] = await db.query(
      "UPDATE users SET salary = ?, designation = ?, updated_at = NOW() WHERE id = ?",
      [Number(salary), designation || null, userId]
    );

    if (!updatedUser?.affectedRows) {
      return res.status(404).json({ message: "User not found" });
    }

    const [userRows] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
    return res.json({ message: "Salary saved", user: userRows[0] || null, ...updatedUser });
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
    const users = await SalaryPaymentsModel.findAll();
    return res.json(users);
  } catch (err) {
    console.error("getAllEmployeesWithSalary error:", err);
    return res.status(500).json({ message: "Failed to fetch salaries" });
  }
};

/**
 * ADMIN or SELF: Get salary of a user.
 * GET /api/salary/:userId
 */
exports.getEmployeeSalary = async (req, res) => {
  try {
    const { userId } = req.params;
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (requester.role !== "admin" && Number(requester.id) !== Number(userId)) {
      return res.status(403).json({ message: "Forbidden: can only view your own salary" });
    }

    const [rows] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
    const user = rows[0] || null;
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
    const [rows] = await db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    const user = rows[0] || null;
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

    // v4 has no users.salary / users.designation columns. Salary lives on
    // employees.base_salary and designation is employees.designation_id ->
    // designations.name. attendance_records keys off employee_id (employees.id),
    // not users.id, so resolve the employee row for this user first.
    const [employeeRows] = await db.query(
      `SELECT e.id AS employee_id, e.base_salary, e.employee_code,
              d.name AS designation
       FROM employees e
       LEFT JOIN designations d ON d.id = e.designation_id
       WHERE e.user_id = ? AND e.is_active = 1
       ORDER BY e.id
       LIMIT 1`,
      [id]
    );
    const employee = Array.isArray(employeeRows) ? employeeRows[0] || null : null;
    const monthlySalary = Number(employee?.base_salary || 0);

    let records = [];
    if (employee) {
      records = await AttendanceRecordsModel.findByEmployeeAndMonth(
        employee.employee_id,
        month,
        year
      );
    }

    const attendanceRecords = records.map((r) => {
      const status = String(r.status || "").toLowerCase();
      const daySalary = calculateDaySalary(monthlySalary, status, year, month);
      return {
        id: r.id,
        date: r.date,
        status,
        checkIn: r.check_in,
        checkOut: r.check_out,
        daySalary,
        leaveType: r.leave_type,
        notes: r.notes,
      };
    });

    const totalPaid = attendanceRecords.reduce((sum, r) => sum + r.daySalary, 0);

    // A user without an employee record (or with no attendance yet) is a valid
    // state: return well-formed zeroed totals and an empty records array.
    return res.json({
      employee: {
        id,
        employeeId: employee?.employee_id || null,
        employeeCode: employee?.employee_code || null,
        salary: monthlySalary,
        designation: employee?.designation || null,
      },
      month: `${year}-${String(month).padStart(2, "0")}`,
      attendanceRecords,
      totalPaid: Number(totalPaid.toFixed(2)),
    });
  } catch (err) {
    console.error("getMyAttendanceWithSalary error:", err.message || err);
    return res.status(500).json({ message: "Failed to fetch attendance", error: err.message });
  }
};

/**
 * ADMIN: Generate a payroll report for a given month.
 * Uses actual attendance data (including eSSL-biometric imports) to compute
 * earned pay per employee.
 *
 * GET /api/salary/payroll?month=YYYY-MM
 *   or  /api/salary/payroll  (defaults to current month)
 */
exports.getPayrollReport = async (req, res) => {
  try {
    const { month: monthParam } = req.query || {};
    const [year, month] = monthParam ? monthParam.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];

    // 1. Fetch all active employees with their base salary
    const [employees] = await db.query(
      `SELECT e.id AS employee_id, e.employee_code, e.base_salary, e.user_id,
              u.name AS employee_name, u.email AS employee_email,
              d.name AS designation
       FROM employees e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN designations d ON d.id = e.designation_id
       WHERE e.is_active = 1
       ORDER BY u.name`
    );

    // 2. For each employee, fetch their attendance records for the month
    const now = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();

    const payroll = [];
    for (const emp of employees) {
      const records = await AttendanceRecordsModel.findByEmployeeAndMonth(
        emp.employee_id,
        month,
        year
      );

      // Count each status category
      const counts = { present: 0, absent: 0, late: 0, half_day: 0, on_leave: 0, holiday: 0, week_off: 0 };
      let biometricDays = 0;
      let manualDays = 0;

      for (const rec of records) {
        const status = String(rec.status || "").toLowerCase();
        if (counts[status] !== undefined) counts[status]++;
        if (String(rec.method || "").toLowerCase() === "biometric") biometricDays++;
        else manualDays++;
      }

      const monthlySalary = Number(emp.base_salary || 0);
      const daily = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;

      // Earned pay = base salary for present/late/holiday/week_off days
      // (late is 50%, half_day is 50% per the multipliers)
      let earnedPay = 0;
      earnedPay += counts.present * daily;
      earnedPay += counts.late * daily * 0.5;
      earnedPay += counts.holiday * daily;
      earnedPay += counts.week_off * daily;
      // half_day = 50%, absent = 0, on_leave = 0

      payroll.push({
        employeeId: emp.employee_id,
        employeeCode: emp.employee_code,
        employeeName: emp.employee_name,
        employeeEmail: emp.employee_email,
        designation: emp.designation,
        monthlySalary,
        dailyRate: Number(daily.toFixed(2)),
        attendance: counts,
        totalDays: daysInMonth,
        presentDays: counts.present,
        lateDays: counts.late,
        absentDays: counts.absent,
        onLeaveDays: counts.on_leave,
        holidayDays: counts.holiday,
        biometricDays,
        manualDays,
        earnedPay: Number(earnedPay.toFixed(2)),
      });
    }

    // Summary
    const totalEarned = payroll.reduce((s, p) => s + p.earnedPay, 0);
    const totalSalary = payroll.reduce((s, p) => s + p.monthlySalary, 0);
    const avgEarnedPct = totalSalary > 0 ? ((totalEarned / totalSalary) * 100).toFixed(1) : "0";

    res.json({
      month: `${year}-${String(month).padStart(2, "0")}`,
      daysInMonth,
      employees: payroll,
      summary: {
        totalEmployees: payroll.length,
        totalMonthlySalary: Number(totalSalary.toFixed(2)),
        totalEarnedPay: Number(totalEarned.toFixed(2)),
        avgEarnedPercent: avgEarnedPct,
      },
    });
  } catch (err) {
    console.error("getPayrollReport error:", err);
    res.status(500).json({ message: "Failed to fetch payroll report", error: err.message });
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
    // v4: salary is on employees.base_salary and attendance is keyed by
    // employee_id, so resolve the employee row for this user first.
    const [employeeRows] = await db.query(
      "SELECT id, base_salary FROM employees WHERE user_id = ? ORDER BY id LIMIT 1",
      [userId]
    );
    const employee = Array.isArray(employeeRows) ? employeeRows[0] || null : null;
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const now = new Date();
    const records = await AttendanceRecordsModel.findByEmployeeAndMonth(employee.id, now.getMonth() + 1, now.getFullYear());

    // attendance_records in v4 has no salary_amount column; derive the computed
    // amount per record and return it rather than persisting a non-existent field.
    const updates = records.map((r) => {
      const dateStr = String(r.date || "").slice(0, 7);
      const [y, m] = dateStr.split("-").map(Number);
      const amount = calculateDaySalary(employee.base_salary, r.status, y, m);
      return { id: r.id, amount };
    });

    return res.json({ message: "Attendance recalculated", updates });
  } catch (err) {
    console.error("recalculateAttendance error:", err.message || err);
    return res.status(500).json({ message: "Failed to recalculate", error: err.message });
  }
};
