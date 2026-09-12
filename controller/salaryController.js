const db = require("../config/db");
const SalaryPaymentsModel = require("../models/SalaryPaymentsModel");
const AttendanceRecordsModel = require("../models/AttendanceRecordsModel");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

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

    const updatedUser = await runQuery(
      "UPDATE users SET salary = ?, designation = ?, updated_at = NOW() WHERE id = ?",
      [Number(salary), designation || null, userId]
    );

    if (!updatedUser?.affectedRows) {
      return res.status(404).json({ message: "User not found" });
    }

    const [userRows] = await runQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
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

    const [rows] = await runQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
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
    const [rows] = await runQuery("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
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

    const [userRows] = await runQuery("SELECT salary, designation FROM users WHERE id = ? LIMIT 1", [id]);
    const user = userRows[0] || null;
    const monthlySalary = Number(user?.salary || 0);

    const records = await AttendanceRecordsModel.findByEmployeeAndMonth(id, month, year);

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

    return res.json({
      employee: {
        id,
        salary: monthlySalary,
        designation: user?.designation || null,
      },
      month: `${year}-${String(month).padStart(2, "0")}`,
      attendanceRecords,
      totalPaid: Number(totalPaid.toFixed(2)),
    });
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
    const [userRows] = await runQuery("SELECT salary FROM users WHERE id = ? LIMIT 1", [userId]);
    const user = userRows[0] || null;
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const records = await AttendanceRecordsModel.findByEmployeeAndMonth(userId);

    const updates = await Promise.all(
      records.map(async (r) => {
        const dateStr = String(r.date || "").slice(0, 7);
        const [y, m] = dateStr.split("-").map(Number);
        const amount = calculateDaySalary(user.salary, r.status, y, m);
        await runQuery("UPDATE attendance_records SET salary_amount = ? WHERE id = ?", [amount, r.id]);
        return { id: r.id, amount };
      })
    );

    return res.json({ message: "Attendance recalculated", updates });
  } catch (err) {
    console.error("recalculateAttendance error:", err);
    return res.status(500).json({ message: "Failed to recalculate" });
  }
};
