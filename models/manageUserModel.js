const bcrypt = require("bcryptjs");
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const columnExists = async (column) => {
  const rows = await runQuery("SHOW COLUMNS FROM register LIKE ?", [column]);
  return Array.isArray(rows) && rows.length > 0;
};

const addColumnIfMissing = async (column, definition) => {
  if (!(await columnExists(column))) {
    await runQuery(`ALTER TABLE register ADD COLUMN ${column} ${definition}`);
  }
};

const ensureSchema = async () => {
  // base table is created by app bootstrap; here we just extend it
  await runQuery(`
    CREATE TABLE IF NOT EXISTS register (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'staff',
      avatar_url VARCHAR(255) DEFAULT NULL
    )
  `);

  await addColumnIfMissing("username", "VARCHAR(100) DEFAULT NULL");
  await addColumnIfMissing("designation", "VARCHAR(150) DEFAULT NULL");
  await addColumnIfMissing("contact_number", "VARCHAR(50) DEFAULT NULL");
  await addColumnIfMissing("address", "VARCHAR(255) DEFAULT NULL");
  await addColumnIfMissing("is_active", "TINYINT(1) NOT NULL DEFAULT 1");

  // backfill username from email prefix for any row missing it
  await runQuery(`
    UPDATE register
       SET username = SUBSTRING_INDEX(email, '@', 1)
     WHERE username IS NULL OR username = ''
  `);
};

const listUsers = async () => {
  const rows = await runQuery(`
    SELECT id, username, name AS fullname, designation, contact_number,
           email, address, role, is_active
      FROM register
     ORDER BY id ASC
  `);
  return rows.map((r) => ({
    id: r.id,
    username: r.username || "",
    fullname: r.fullname || "",
    designation: r.designation || "",
    contact_number: r.contact_number || "",
    email: r.email || "",
    address: r.address || "",
    role: r.role || "",
    is_active: Number(r.is_active) === 1,
  }));
};

const sanitize = (body) => {
  const username = String(body?.username || "").trim();
  const fullname = String(body?.fullname || body?.name || "").trim();
  const email = String(body?.email || "").trim();
  const role = String(body?.role || "staff").trim();
  const designation = String(body?.designation || "").trim() || null;
  const contact_number = String(body?.contact_number || "").trim() || null;
  const address = String(body?.address || "").trim() || null;
  const is_active = body?.is_active === false || body?.is_active === 0 ? 0 : 1;

  if (!fullname) throw new Error("Fullname is required");
  if (!email) throw new Error("Email is required");
  if (!role) throw new Error("Role is required");

  return {
    username: username || email.split("@")[0],
    fullname,
    email,
    role,
    designation,
    contact_number,
    address,
    is_active,
  };
};

const createUser = async (body) => {
  const p = sanitize(body);
  const password = String(body?.password || "").trim();
  if (!password) throw new Error("Password is required for new users");
  const hashed = await bcrypt.hash(password, 10);
  const result = await runQuery(
    `INSERT INTO register
       (username, name, email, password, role, designation, contact_number, address, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.username,
      p.fullname,
      p.email,
      hashed,
      p.role,
      p.designation,
      p.contact_number,
      p.address,
      p.is_active,
    ],
  );
  return { id: result.insertId, ...p };
};

const updateUser = async (id, body) => {
  const p = sanitize(body);
  const password = body?.password ? String(body.password).trim() : "";

  const fields = [
    "username = ?",
    "name = ?",
    "email = ?",
    "role = ?",
    "designation = ?",
    "contact_number = ?",
    "address = ?",
    "is_active = ?",
  ];
  const values = [
    p.username,
    p.fullname,
    p.email,
    p.role,
    p.designation,
    p.contact_number,
    p.address,
    p.is_active,
  ];

  if (password) {
    fields.push("password = ?");
    values.push(await bcrypt.hash(password, 10));
  }

  values.push(id);
  await runQuery(`UPDATE register SET ${fields.join(", ")} WHERE id = ?`, values);
  return { id: Number(id), ...p };
};

const deleteUser = async (id) => {
  await runQuery("DELETE FROM register WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
};
