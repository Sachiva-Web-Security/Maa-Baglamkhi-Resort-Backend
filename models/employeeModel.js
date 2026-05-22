const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS employees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date_of_joining DATE DEFAULT NULL,
      designation VARCHAR(150) DEFAULT NULL,
      address VARCHAR(500) DEFAULT NULL,
      mobile_number VARCHAR(50) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    )
  `);
};

const formatDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Name is required");
  return {
    name,
    date_of_joining: body?.date_of_joining
      ? formatDate(body.date_of_joining)
      : null,
    designation: String(body?.designation || "").trim() || null,
    address: String(body?.address || "").trim() || null,
    mobile_number: String(body?.mobile_number || "").trim() || null,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  date_of_joining: formatDate(r.date_of_joining),
  designation: r.designation || "",
  address: r.address || "",
  mobile_number: r.mobile_number || "",
  is_active: Number(r.is_active) === 1,
});

const listEmployees = async () => {
  const rows = await runQuery(
    "SELECT * FROM employees ORDER BY id ASC",
  );
  return rows.map(mapRow);
};

const createEmployee = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO employees
       (name, date_of_joining, designation, address, mobile_number, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [p.name, p.date_of_joining, p.designation, p.address, p.mobile_number, p.is_active],
  );
  return { id: result.insertId, ...p, is_active: !!p.is_active };
};

const updateEmployee = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE employees
        SET name = ?, date_of_joining = ?, designation = ?, address = ?,
            mobile_number = ?, is_active = ?
      WHERE id = ?`,
    [p.name, p.date_of_joining, p.designation, p.address, p.mobile_number, p.is_active, id],
  );
  return { id: Number(id), ...p, is_active: !!p.is_active };
};

const deleteEmployee = async (id) => {
  await runQuery("DELETE FROM employees WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
