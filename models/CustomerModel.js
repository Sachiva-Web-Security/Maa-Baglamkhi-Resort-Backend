const db = require("../config/db");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function createCustomerTable() {
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) DEFAULT '',
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20) DEFAULT '',
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'customer',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function findCustomerByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const [rows] = await db.promise().query(
    "SELECT * FROM customers WHERE LOWER(TRIM(email)) = ? LIMIT 1",
    [normalizedEmail]
  );
  return rows[0];
}

async function createCustomer(data) {
  const { first_name, last_name, email, phone, password } = data;
  const normalizedEmail = normalizeEmail(email);

  const [result] = await db.promise().query(
    `INSERT INTO customers (first_name, last_name, email, phone, password)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(first_name || "").trim(),
      String(last_name || "").trim(),
      normalizedEmail,
      String(phone || "").trim(),
      password,
    ]
  );

  return result.insertId;
}

async function findCustomerById(id) {
  const [rows] = await db.promise().query(
    "SELECT id, first_name, last_name, email, phone FROM customers WHERE id = ?",
    [id]
  );
  return rows[0];
}




async function updateCustomerById(id, updates = {}) {
  const first_name = String(updates.first_name ?? "").trim();
  const last_name = String(updates.last_name ?? "").trim();
  const phone = String(updates.phone ?? "").trim();
  const [result] = await db.promise().query(
    `UPDATE customers
     SET first_name = ?, last_name = ?, phone = ?
     WHERE id = ?`,
    [first_name, last_name, phone, id],
  );
  return result.affectedRows > 0;
}






module.exports = {
  createCustomerTable,
  findCustomerByEmail,
  createCustomer,
  findCustomerById,
  normalizeEmail,
  updateCustomerById, // ✅ add
};
