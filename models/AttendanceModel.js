const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

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

const getByDate = (date, callback) => {
  db.query(
    "SELECT id, date, employee_name AS name, role, department, check_in AS checkIn, check_out AS checkOut, status, method FROM attendance_records WHERE date = ? ORDER BY employee_name",
    [date],
    callback,
  );
};

const createRecord = (data, callback) => {
  const sql =
    "INSERT INTO attendance_records (date, employee_name, role, department, check_in, check_out, status, method) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
  db.query(
    sql,
    [
      data.date,
      data.name,
      data.role,
      data.department,
      data.checkIn,
      data.checkOut,
      data.status,
      data.method,
    ],
    callback,
  );
};

module.exports = {
  ensureSchema,
  getByDate,
  createRecord,
};
