const db = require("../config/db");
const AttendanceRecordsModel = require("../models/AttendanceRecordsModel");
const UsersModel = require("../models/UsersModel");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });

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

exports.getMyAttendance = async (req, res) => {
  const id = req.user?.id;
  if (!id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  return withAttendanceSchema(res, async () => {
    const [rows] = await runQuery(
      "SELECT * FROM attendance_records WHERE user_id = ? ORDER BY date DESC",
      [id]
    );
    res.json(rows);
  });
};

exports.getAllAttendance = async (req, res) => {
  return withAttendanceSchema(res, async () => {
    const [users] = await UsersModel.findAll();
    const userIds = users.map((u) => u.id);
    const placeholders = userIds.map(() => "?").join(",");
    const records = userIds.length
      ? await runQuery(
          `SELECT * FROM attendance_records WHERE user_id IN (${placeholders}) ORDER BY date DESC`,
          userIds
        )
      : [];

    const enrichedRecords = await Promise.all(
      records.map(async (record) => {
        const [matched] = await UsersModel.findById(record.user_id);
        const user = matched[0] || {};
        return {
          ...record,
          userName: user.name || null,
          userEmail: user.email || null,
        };
      })
    );

    res.json(enrichedRecords);
  });
};

exports.markMyAttendance = async (req, res) => {
  const id = req.user?.id;
  if (!id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const { status } = req.body || {};
  const normalized = normalizeStatus(status);

  if (!["present", "absent", "late", "half_day", "on_leave", "holiday", "week_off"].includes(normalized)) {
    return res.status(400).json({ message: "Invalid attendance status" });
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toISOString().slice(11, 19);

  return withAttendanceSchema(res, async () => {
    const existing = await runQuery(
      "SELECT id FROM attendance_records WHERE user_id = ? AND date = ? LIMIT 1",
      [id, dateStr]
    );

    if (existing[0]) {
      return res.status(409).json({ message: "Attendance already marked for today" });
    }

    const [result] = await runQuery(
      `INSERT INTO attendance_records (user_id, date, status, check_in, check_out, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, dateStr, normalized, timeStr, timeStr]
    );

    res.json({
      message: "Attendance marked successfully",
      id: result.insertId,
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
    const [result] = await runQuery(
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
    const [userRows] = await runQuery("SELECT salary, designation FROM users WHERE id = ? LIMIT 1", [id]);
    const user = userRows[0] || null;
    const monthlySalary = Number(user?.salary || 0);

    const records = await AttendanceRecordsModel.findByEmployeeAndMonth(id, targetMonth, targetYear);

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
        salary: monthlySalary,
        designation: user?.designation || null,
      },
      month: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
      attendanceRecords,
      totalPaid: Number(totalPaid.toFixed(2)),
    });
  });
};
