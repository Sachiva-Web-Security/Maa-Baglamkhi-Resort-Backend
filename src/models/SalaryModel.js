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

module.exports = {
  calculateDaySalary,
  setSalary,
  getSalaryByUserId,
  getAllSalaries,
  updateAttendanceSalary,
  getAttendanceByUserId,
  getMonthlySalarySummary,
};
