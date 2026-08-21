const AttendanceModel = require("../models/AttendanceModel");
const SalaryModel = require("../models/SalaryModel");
const db = require("../config/db");

/**
 * Compute per-day salary amount for a record based on user's monthly salary + status.
 */
function calcDayAmount(monthlySalary, status, dateStr) {
  if (!monthlySalary || !dateStr) return 0;
  const [year, month] = dateStr.split("-").map(Number);
  return SalaryModel.calculateDaySalary(monthlySalary, status, year, month);
}

/**
 * GET /api/attendance?date=YYYY-MM-DD
 * Admin sees all rows for the date. Non-admin sees only own rows.
 * Each row now includes user_salary (monthly) and salary_amount (per-day calculated).
 */
exports.getForDate = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: "date query required" });

  AttendanceModel.getByDate(date, async (err, rows) => {
    if (err) {
      console.error("Error fetching attendance:", err);
      return res.status(500).json({ message: "Error fetching attendance" });
    }

    try {
      // For each row, try to find the matching user to attach salary information
      // We do this by `staff_name` (since older rows have name only) OR user_id if present.
      const enriched = await Promise.all(
        rows.map(async (row) => {
          let monthlySalary = 0;
          let userId = row.user_id || null;

          if (userId) {
            const user = await SalaryModel.getSalaryByUserId(userId);
            monthlySalary = parseFloat(user?.salary || 0);
          } else if (row.name) {
            // Lookup by name (legacy rows)
            const userRows = await new Promise((resolve, reject) => {
              db.query(
                "SELECT id, salary FROM register WHERE name = ? LIMIT 1",
                [row.name],
                (e, r) => (e ? reject(e) : resolve(r))
              );
            });
            if (userRows?.[0]) {
              userId = userRows[0].id;
              monthlySalary = parseFloat(userRows[0].salary || 0);
            }
          }

          const calc = calcDayAmount(monthlySalary, row.status, row.date);
          return {
            ...row,
            user_id: userId,
            user_salary: monthlySalary,
            salary_amount: calc,
          };
        })
      );

      return res.json(enriched);
    } catch (innerErr) {
      console.error("Error enriching attendance:", innerErr);
      // Fall back to plain rows if enrichment fails
      return res.json(rows);
    }
  });
};

/**
 * POST /api/attendance
 * Admin only: create attendance record.
 * Body: { date, user_id, name, role, department, status, checkIn, checkOut, notes }
 * Salary amount is auto-calculated based on user's monthly salary + status.
 */
exports.createManual = (req, res) => {
  const data = req.body;
  if (!data.date || (!data.user_id && !data.name) || !data.role || !data.status) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // Resolve name from user_id if needed
  const finish = (name) => {
    const payload = { ...data, name: name || data.name };
    AttendanceModel.createRecord(payload, async (err, result) => {
      if (err) {
        console.error("Error creating attendance:", err);
        return res.status(500).json({ message: "Error creating record" });
      }

      // Calculate salary_amount now that we have the record id and date
      const recordId = result.insertId;
      let monthlySalary = 0;

      try {
        if (data.user_id) {
          const user = await SalaryModel.getSalaryByUserId(data.user_id);
          monthlySalary = parseFloat(user?.salary || 0);
        }
      } catch (e) {
        console.error("Salary lookup error:", e);
      }

      const calc = calcDayAmount(monthlySalary, data.status, data.date);

      // Update the just-created record with calculated salary_amount + user_id
      db.query(
        "UPDATE attendance_records SET salary_amount = ?, user_id = COALESCE(user_id, ?) WHERE id = ?",
        [calc, data.user_id || null, recordId],
        (updErr) => {
          if (updErr) {
            console.error("Update salary error:", updErr);
          }
          return res.json({
            message: "Attendance saved",
            id: recordId,
            salary_amount: calc,
            user_salary: monthlySalary,
          });
        }
      );
    });
  };

  if (data.user_id && !data.name) {
    SalaryModel.getSalaryByUserId(data.user_id)
      .then((u) => finish(u?.name))
      .catch(() => finish(data.name));
  } else {
    finish(data.name);
  }
};
