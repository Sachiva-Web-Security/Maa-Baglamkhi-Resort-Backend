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

const findUserById = (id, callback) => {
  const sql = "SELECT * FROM register WHERE id = ?";
  db.query(sql, [id], callback);
};

const countUsers = (callback) => {
  const sql = "SELECT COUNT(*) AS c FROM register";
  db.query(sql, (err, rows) => {
    if (err) return callback(err);
    callback(null, rows?.[0]?.c ?? 0);
  });
};

const updatePasswordByEmail = (email, hashedPassword, callback) => {
  const sql = "UPDATE register SET password = ? WHERE email = ?";
  db.query(sql, [hashedPassword, email], callback);
};

const updateAvatarUrlByEmail = (email, avatarUrl, callback) => {
  // Note: this requires an `avatar_url` column in `register`. If missing, controller should handle error gracefully.
  const sql = "UPDATE register SET avatar_url = ? WHERE email = ?";
  db.query(sql, [avatarUrl, email], callback);
};

const updatePhoneByEmail = (phone, email, callback) => {
  const sql = "UPDATE register SET phone = ? WHERE email = ?";
  db.query(sql, [phone, email], callback);
};

const findAdminUser = (callback) => {
  const sql = "SELECT id, name, email, phone FROM register WHERE LOWER(role) = 'admin' ORDER BY id ASC LIMIT 1";
  db.query(sql, callback);
};

/**
 * Find the first admin user that has a non-empty phone number.
 * Falls back to the first admin (by id) even if phone is null/empty,
 * so callers can distinguish "no admin has a phone" from "found one".
 */
const findAdminWithPhone = (callback) => {
  const sql =
    "SELECT id, name, email, phone FROM register WHERE LOWER(role) = 'admin' AND phone IS NOT NULL AND TRIM(phone) <> '' ORDER BY id ASC LIMIT 1";
  db.query(sql, (err, rows) => {
    if (err) return callback(err);
    if (rows && rows.length > 0) return callback(null, rows[0]);

    // Fallback: no admin has a phone — return the first admin anyway
    const sql2 =
      "SELECT id, name, email, phone FROM register WHERE LOWER(role) = 'admin' ORDER BY id ASC LIMIT 1";
    db.query(sql2, (err2, rows2) => {
      if (err2) return callback(err2);
      callback(null, rows2 && rows2.length > 0 ? rows2[0] : null);
    });
  });
};

const getAllUsers = (callback) => {
  const sql = "SELECT id, name, email, role FROM register";
  db.query(sql, callback);
};

const deleteUserById = (id, callback) => {
  const sql = "DELETE FROM register WHERE id = ?";
  db.query(sql, [id], callback);
};

const updateUserById = (id, data, callback) => {
  const fields = ["name = ?", "email = ?", "role = ?"];
  const values = [data.name, data.email, data.role];

  if (data.password) {
    fields.push("password = ?");
    values.push(data.password);
  }

  values.push(id);
  const sql = `UPDATE register SET ${fields.join(", ")} WHERE id = ?`;
  db.query(sql, values, callback);
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  countUsers,
  updatePasswordByEmail,
  updateAvatarUrlByEmail,
  updatePhoneByEmail,
  findAdminUser,
  findAdminWithPhone,
  getAllUsers,
  deleteUserById,
  updateUserById,
};
