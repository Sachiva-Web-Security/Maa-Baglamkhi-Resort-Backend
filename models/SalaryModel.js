const db = require("../config/db");

// Salary is stored directly on the `register` table as a `salary` column.
// This model adds helper CRUD and per-day salary calculation logic.

/**
 * Get per-day salary for a user based on status and monthly salary.
 *
 * Rules:
 *  - Present       → full day   (monthlySalary / daysInMonth)
 *  - Absent        → 0
 *  - Late          → full minus lateDeductionPct
 *  - Half Day      → half day
 *  - On Leave      → 0  (change to full or leaveDeductionPct as needed)
 */
function calculateDaySalary(monthlySalary, status, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const fullDaySalary = daysInMonth > 0 ? parseFloat(monthlySalary) / daysInMonth : 0;

  switch (status) {
    case "Present":
      return parseFloat(fullDaySalary.toFixed(2));
    case "Absent":
      return 0;
    case "Late":
      return parseFloat((fullDaySalary * 0.9).toFixed(2)); // 10% late deduction
    case "Half Day":
      return parseFloat((fullDaySalary / 2).toFixed(2));
    case "On Leave":
      return 0;
    default:
      return 0;
  }
}

/**
 * Set / update salary for a user (admin).
 */
const setSalary = (userId, salary, designation) => {
  return new Promise((resolve, reject) => {
    if (!userId || salary === undefined || salary === null) {
      return reject(new Error("userId and salary required"));
    }
    db.query(
      "UPDATE register SET salary = ?, designation = ? WHERE id = ?",
      [salary, designation || "", userId],
      (err, result) => {
        if (err) return reject(err);
        if (!result?.affectedRows) return reject(new Error("User not found"));
        resolve({ message: "Salary updated" });
      }
    );
  });
};

/**
 * Get salary info for a single user.
 */
const getSalaryByUserId = (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, name, email, role, designation, salary FROM register WHERE id = ?",
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows?.[0] || null);
      }
    );
  });
};

/**
 * Get all users with their salary info (admin view).
 */
const getAllSalaries = () => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT id, name, email, role, designation, salary, avatar_url FROM register ORDER BY name",
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
};

/**
 * Update salary_amount on an attendance record and return the updated row.
 */
const updateAttendanceSalary = (recordId, salaryAmount) => {
  return new Promise((resolve, reject) => {
    db.query(
      "UPDATE attendance_records SET salary_amount = ? WHERE id = ?",
      [salaryAmount, recordId],
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
};

/**
 * Get attendance records for a specific user (for salary summary).
 */
const getAttendanceByUserId = (userId, fromDate, toDate) => {
  return new Promise((resolve, reject) => {
    const params = [userId];
    const where = ["user_id = ?"];

    if (fromDate) {
      where.push("date >= ?");
      params.push(fromDate);
    }
    if (toDate) {
      where.push("date <= ?");
      params.push(toDate);
    }

    const sql = `SELECT * FROM attendance_records WHERE ${where.join(" AND ")} ORDER BY date DESC`;
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

/**
 * Get monthly salary summary for a user.
 */
const getMonthlySalarySummary = (userId, year, month) => {
  return new Promise((resolve, reject) => {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    db.query(
      `SELECT id, date, status, salary_amount, notes, in_time, out_time
       FROM attendance_records
       WHERE user_id = ? AND date BETWEEN ? AND ?
       ORDER BY date DESC`,
      [userId, startDate, endDate],
      async (err, rows) => {
        if (err) return reject(err);

        // Get user's monthly salary
        const user = await getSalaryByUserId(userId);
        const monthlySalary = parseFloat(user?.salary || 0);
        const totalDays = rows.length;
        const totalPaid = rows.reduce((sum, r) => sum + parseFloat(r.salary_amount || 0), 0);

        resolve({
          user,
          records: rows,
          summary: {
            monthlySalary,
            totalWorkingDays: totalDays,
            totalAmountEarned: parseFloat(totalPaid.toFixed(2)),
            month: `${year}-${String(month).padStart(2, "0")}`,
          },
        });
      }
    );
  });
};

/* ==================== SALARY PAYMENT TRACKING ==================== */

/**
 * Get all salary payment records (optionally filtered by user/month).
 */
const getSalaryPayments = (filters = {}) => {
  return new Promise((resolve, reject) => {
    const params = [];
    const where = [];
    if (filters.userId) { where.push("user_id = ?"); params.push(filters.userId); }
    if (filters.year) { where.push("year = ?"); params.push(filters.year); }
    if (filters.month) { where.push("month = ?"); params.push(filters.month); }
    const sql = `SELECT * FROM salary_payments ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY year DESC, month DESC, user_id`;
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

/**
 * Get a single salary payment record by user + year + month.
 */
const getSalaryPayment = (userId, year, month) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM salary_payments WHERE user_id = ? AND year = ? AND month = ?",
      [userId, year, month],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows?.[0] || null);
      }
    );
  });
};

/**
 * Create or update a salary payment record.
 */
const upsertSalaryPayment = ({ userId, year, month, status, amountPaid, paymentMode, paidOn, notes, createdBy }) => {
  return new Promise((resolve, reject) => {
    db.query(
      `INSERT INTO salary_payments (user_id, year, month, status, amount_paid, payment_mode, paid_on, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), amount_paid = VALUES(amount_paid),
       payment_mode = VALUES(payment_mode), paid_on = VALUES(paid_on), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP`,
      [userId, year, month, status || "Pending", amountPaid ?? 0, paymentMode || null, paidOn || null, notes || null, createdBy || null],
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
};

/**
 * Get a combined month summary for an employee:
 * monthly salary, attendance-based earned amount, and payment status.
 */
const getEmployeeMonthSummary = (userId, year, month) => {
  return new Promise((resolve, reject) => {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    Promise.all([
      getSalaryByUserId(userId),
      new Promise((res, rej) => {
        db.query(
          `SELECT status, COUNT(*) as days, SUM(salary_amount) as earned
           FROM attendance_records
           WHERE user_id = ? AND date BETWEEN ? AND ?
           GROUP BY status`,
          [userId, startDate, endDate],
          (err, rows) => { if (err) return rej(err); res(rows); }
        );
      }),
      getSalaryPayment(userId, year, month),
    ]).then(([user, attendance, payment]) => {
      const monthlySalary = parseFloat(user?.salary || 0);
      const totalEarned = attendance.reduce((s, r) => s + parseFloat(r.earned || 0), 0);
      const totalPresent = attendance.find(r => r.status === "Present")?.days || 0;
      const totalAbsent = attendance.find(r => r.status === "Absent")?.days || 0;
      const totalLate = attendance.find(r => r.status === "Late")?.days || 0;
      const totalHalfDay = attendance.find(r => r.status === "Half Day")?.days || 0;
      resolve({
        user,
        payment,
        summary: {
          monthlySalary,
          totalEarned: parseFloat(totalEarned.toFixed(2)),
          totalPresent,
          totalAbsent,
          totalLate,
          totalHalfDay,
          status: payment?.status || "Pending",
          amountPaid: parseFloat(payment?.amount_paid || 0),
          paidOn: payment?.paid_on || null,
          paymentMode: payment?.payment_mode || null,
        },
      });
    }).catch(reject);
  });
};

/**
 * Get payment history for an employee across months.
 */
const getSalaryPaymentHistory = (userId, limit = 12) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT * FROM salary_payments WHERE user_id = ? ORDER BY year DESC, month DESC LIMIT ?";
    db.query(sql, [userId, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

module.exports = {
  calculateDaySalary,
  setSalary,
  getSalaryByUserId,
  getAllSalaries,
  updateAttendanceSalary,
  getAttendanceByUserId,
  getMonthlySalarySummary,
  getSalaryPayments,
  getSalaryPayment,
  upsertSalaryPayment,
  getEmployeeMonthSummary,
  getSalaryPaymentHistory,
};
