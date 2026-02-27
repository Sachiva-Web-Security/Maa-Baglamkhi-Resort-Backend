const db = require("../config/db");

const createUser = (data, callback) => {
  const sql =
    "INSERT INTO register (name, email, password, role) VALUES (?, ?, ?, ?)";
  db.query(sql, [data.name, data.email, data.password, data.role], callback);
};

const findUserByEmail = (email, callback) => {
  const sql = "SELECT * FROM register WHERE email = ?";
  db.query(sql, [email], callback);
};

const getAllUsers = (callback) => {
  const sql = "SELECT id, name, email, role FROM register";
  db.query(sql, callback);
};

module.exports = {
  createUser,
  findUserByEmail,
  getAllUsers,
};