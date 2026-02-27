const db = require("../config/db");

const getByDate = (date, callback) => {
  db.query(
    "SELECT id, date, employee_name AS name, role, department, check_in AS checkIn, check_out AS checkOut, status, method FROM attendance_records WHERE date = ? ORDER BY employee_name",
    [date],
    callback
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
    callback
  );
};

module.exports = { getByDate, createRecord };

