const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const columnExists = async (columnName) => {
  const rows = await runQuery(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'attendance_records'
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [columnName],
  );

  return rows.length > 0;
};

const getSchemaProfile = async () => {
  const [
    hasEmployeeName,
    hasStaffName,
    hasDepartment,
    hasCheckIn,
    hasInTime,
    hasCheckOut,
    hasOutTime,
    hasMethod,
    hasNotes,
  ] = await Promise.all([
    columnExists("employee_name"),
    columnExists("staff_name"),
    columnExists("department"),
    columnExists("check_in"),
    columnExists("in_time"),
    columnExists("check_out"),
    columnExists("out_time"),
    columnExists("method"),
    columnExists("notes"),
  ]);

  return {
    nameColumn: hasEmployeeName ? "employee_name" : hasStaffName ? "staff_name" : null,
    hasDepartment,
    checkInColumn: hasCheckIn ? "check_in" : hasInTime ? "in_time" : null,
    checkOutColumn: hasCheckOut ? "check_out" : hasOutTime ? "out_time" : null,
    hasMethod,
    hasNotes,
  };
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      employee_name VARCHAR(100) NOT NULL,
      role VARCHAR(50) NOT NULL,
      department VARCHAR(100) NOT NULL,
      check_in VARCHAR(10) DEFAULT NULL,
      check_out VARCHAR(10) DEFAULT NULL,
      status VARCHAR(20) NOT NULL,
      method VARCHAR(20) NOT NULL
    )
  `);
};

const getByDate = async (date, callback) => {
  try {
    const profile = await getSchemaProfile();
    const nameExpr = profile.nameColumn
      ? `${profile.nameColumn} AS name`
      : "NULL AS name";
    const departmentExpr = profile.hasDepartment
      ? "department"
      : "'General' AS department";
    const checkInExpr = profile.checkInColumn
      ? `${profile.checkInColumn} AS checkIn`
      : "NULL AS checkIn";
    const checkOutExpr = profile.checkOutColumn
      ? `${profile.checkOutColumn} AS checkOut`
      : "NULL AS checkOut";
    const methodExpr = profile.hasMethod
      ? "method"
      : "'Manual' AS method";
    const notesExpr = profile.hasNotes
      ? "notes"
      : "NULL AS notes";
    const orderByExpr = profile.nameColumn || "id";

    const rows = await runQuery(
      `SELECT id, date, ${nameExpr}, role, ${departmentExpr}, ${checkInExpr}, ${checkOutExpr}, status, ${methodExpr}, ${notesExpr}
       FROM attendance_records
       WHERE date = ?
       ORDER BY ${orderByExpr}`,
      [date],
    );

    callback(null, rows);
  } catch (err) {
    callback(err);
  }
};

const createRecord = async (data, callback) => {
  try {
    const profile = await getSchemaProfile();
    const columns = ["date"];
    const values = [data.date];

    if (profile.nameColumn) {
      columns.push(profile.nameColumn);
      values.push(data.name);
    }

    columns.push("role");
    values.push(data.role);

    if (profile.hasDepartment) {
      columns.push("department");
      values.push(data.department || "General");
    }

    if (profile.checkInColumn) {
      columns.push(profile.checkInColumn);
      values.push(data.checkIn || null);
    }

    if (profile.checkOutColumn) {
      columns.push(profile.checkOutColumn);
      values.push(data.checkOut || null);
    }

    columns.push("status");
    values.push(data.status);

    if (profile.hasMethod) {
      columns.push("method");
      values.push(data.method || "Manual");
    }

    if (profile.hasNotes) {
      columns.push("notes");
      values.push(data.notes || null);
    }

    // user_id column (added in v2 schema)
    const hasUserId = await columnExists("user_id");
    if (hasUserId && data.user_id) {
      columns.push("user_id");
      values.push(data.user_id);
    }

    // salary_amount column (added in v2 schema)
    const hasSalaryAmount = await columnExists("salary_amount");
    if (hasSalaryAmount && (data.salary_amount !== undefined && data.salary_amount !== null)) {
      columns.push("salary_amount");
      values.push(data.salary_amount);
    }

    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO attendance_records (${columns.join(", ")}) VALUES (${placeholders})`;
    db.query(sql, values, callback);
  } catch (err) {
    callback(err);
  }
};

module.exports = {
  ensureSchema,
  getByDate,
  createRecord,
};
