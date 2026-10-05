const db = require("../config/db");
const AttendanceRecordsModel = require("../models/AttendanceRecordsModel");
const UsersModel = require("../models/UsersModel");

const SALARY_STATUS_MULTIPLIER = {
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
  const multiplier = SALARY_STATUS_MULTIPLIER[String(status || "").toLowerCase()] || 0;
  return Number((daily * multiplier).toFixed(2));
};

const withAttendanceSchema = async (res, task) => {
  try {
    await AttendanceRecordsModel.ensureSchema();
    await task();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to prepare attendance schema.",
      error,
    });
  }
};

const normalizeStatus = (status) => String(status || "").toLowerCase().trim();

/**
 * Resolve a requesting USER id to an EMPLOYEE id.
 *
 * In v4 attendance is keyed by `attendance_records.employee_id` -> `employees.id`.
 * Requests carry a user id (`req.user.id`), so we look up the linked employee row.
 * Returns `null` when the user has no `employees` row (a valid state, not an error).
 */
const resolveEmployeeId = async (userId) => {
  const [rows] = await db.query(
    "SELECT id FROM employees WHERE user_id = ? LIMIT 1",
    [userId]
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? row.id : null;
};

exports.getMyAttendance = async (req, res) => {
  const id = req.user?.id;
  if (!id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  return withAttendanceSchema(res, async () => {
    const employeeId = await resolveEmployeeId(id);
    if (!employeeId) {
      // No linked employee row: well-formed empty payload, not an error.
      return res.json([]);
    }

    const [rows] = await db.query(
      "SELECT * FROM attendance_records WHERE employee_id = ? ORDER BY date DESC",
      [employeeId]
    );
    res.json(rows);
  });
};

exports.getAllAttendance = async (req, res) => {
  return withAttendanceSchema(res, async () => {
    // Join attendance -> employees -> users so we can enrich with the owner's
    // name/email without a per-row query.
    const [records] = await db.query(
      `SELECT ar.*, e.user_id AS employee_user_id,
              u.name AS employee_name, u.email AS employee_email
       FROM attendance_records ar
       LEFT JOIN employees e ON e.id = ar.employee_id
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY ar.date DESC`
    );

    const enrichedRecords = (Array.isArray(records) ? records : []).map((record) => ({
      ...record,
      userName: record.employee_name || null,
      userEmail: record.employee_email || null,
    }));

    res.json(enrichedRecords);
  });
};

exports.markMyAttendance = async (req, res) => {
  const id = req.user?.id;
  if (!id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const { status, date } = req.body || {};
  const normalized = normalizeStatus(status);

  if (!["present", "absent", "late", "half_day", "on_leave", "holiday", "week_off"].includes(normalized)) {
    return res.status(400).json({ message: "Invalid attendance status" });
  }

  // Honour a caller-supplied date when provided (YYYY-MM-DD), else default to today.
  const requestedDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
    ? date.trim()
    : null;

  const now = new Date();
  const dateStr = requestedDate || now.toISOString().slice(0, 10);
  const timeStr = now.toISOString().slice(11, 19);

  return withAttendanceSchema(res, async () => {
    const employeeId = await resolveEmployeeId(id);
    if (!employeeId) {
      return res.status(400).json({
        message: "No employee record is linked to this user; cannot mark attendance.",
      });
    }

    const [existingRows] = await db.query(
      "SELECT id FROM attendance_records WHERE employee_id = ? AND date = ? LIMIT 1",
      [employeeId, dateStr]
    );

    if (existingRows && existingRows[0]) {
      return res.status(409).json({ message: "Attendance already marked for today" });
    }

    const [result] = await db.query(
      `INSERT INTO attendance_records (employee_id, date, status, check_in, check_out, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [employeeId, dateStr, normalized, timeStr, timeStr]
    );

    res.json({
      message: "Attendance marked successfully",
      id: result.insertId,
      employeeId,
      date: dateStr,
      status: normalized,
    });
  });
};

exports.updateAttendanceRecord = async (req, res) => {
  return withAttendanceSchema(res, async () => {
    const { status, checkIn, checkOut } = req.body || {};
    const recordId = req.params.id;

    if (!recordId) {
      return res.status(400).json({ message: "Attendance record id required" });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push("status = ?");
      params.push(normalizeStatus(status));
    }

    if (checkIn) {
      updates.push("check_in = ?");
      params.push(checkIn);
    }

    if (checkOut) {
      updates.push("check_out = ?");
      params.push(checkOut);
    }

    if (!updates.length) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    params.push(recordId);
    const [result] = await db.query(
      `UPDATE attendance_records SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json({ message: "Attendance record updated" });
  });
};

exports.calculateMySalary = async (req, res) => {
  const id = req.user?.id;
  if (!id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const { month, year } = req.query || {};
  const targetMonth = Number(month || new Date().getMonth() + 1);
  const targetYear = Number(year || new Date().getFullYear());

  return withAttendanceSchema(res, async () => {
    // v4: salary lives on employees.base_salary and attendance is keyed by
    // employee_id, so resolve the employee row for this user first.
    const employeeId = await resolveEmployeeId(id);

    let monthlySalary = 0;
    let designation = null;
    if (employeeId) {
      const [empRows] = await db.query(
        `SELECT e.base_salary, d.name AS designation
         FROM employees e
         LEFT JOIN designations d ON d.id = e.designation_id
         WHERE e.id = ? LIMIT 1`,
        [employeeId]
      );
      const emp = empRows && empRows[0];
      monthlySalary = Number(emp?.base_salary || 0);
      designation = emp?.designation || null;
    }

    const records = employeeId
      ? await AttendanceRecordsModel.findByEmployeeAndMonth(employeeId, targetMonth, targetYear)
      : [];

    const attendanceRecords = records.map((r) => {
      const status = normalizeStatus(r.status);
      const daySalary = calculateDaySalary(monthlySalary, status, targetYear, targetMonth);
      return {
        id: r.id,
        date: r.date,
        status,
        checkIn: r.check_in,
        checkOut: r.check_out,
        daySalary,
      };
    });

    const totalPaid = attendanceRecords.reduce((sum, r) => sum + r.daySalary, 0);

    res.json({
      employee: {
        id,
        employeeId: employeeId || null,
        salary: monthlySalary,
        designation,
      },
      month: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
      attendanceRecords,
      totalPaid: Number(totalPaid.toFixed(2)),
    });
  });
};
