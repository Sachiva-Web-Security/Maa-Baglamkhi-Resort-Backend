const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const VALID_TYPES = ["Captain", "Delivery Boy", "Sales Executive"];

const SEEDS = [
  { name: "MANISH SONANIYA",      date_of_joining: "2023-03-11", designation: "CAPTAIN",    address: "GURADIYA KHATI", contact_number: "7049877812", employee_types: ["Captain"] },
  { name: "NITESH TIWARI",        date_of_joining: "2023-10-01", designation: "RECIPIENTS", address: "BIHAR",          contact_number: "9102154181", employee_types: ["Captain"] },
  { name: "RECEPTION",            date_of_joining: "2020-01-01", designation: "M.D.",       address: "NALKHEDA",       contact_number: "9522238777", employee_types: ["Captain"] },
  { name: "SUMMER SHARMA",        date_of_joining: "2022-05-06", designation: "CAPTAIN",    address: "PANNA",          contact_number: "8349613128", employee_types: ["Captain"] },
  { name: "NARAYAN SINHG GURJAR", date_of_joining: "2024-06-24", designation: "CAPTAIN",    address: "Modi",           contact_number: "7887590641", employee_types: ["Captain"] },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_captains (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      date_of_joining DATE DEFAULT NULL,
      designation VARCHAR(64) DEFAULT NULL,
      address VARCHAR(255) DEFAULT NULL,
      contact_number VARCHAR(32) DEFAULT NULL,
      employee_types VARCHAR(191) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_captains");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const s of SEEDS) {
      await runQuery(
        `INSERT INTO fb_captains
           (name, date_of_joining, designation, address, contact_number, employee_types, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          s.name,
          s.date_of_joining,
          s.designation,
          s.address,
          s.contact_number,
          (s.employee_types || []).join(","),
        ],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  date_of_joining: r.date_of_joining,
  designation: r.designation || "",
  address: r.address || "",
  contact_number: r.contact_number || "",
  employee_types: r.employee_types
    ? String(r.employee_types).split(",").map((s) => s.trim()).filter(Boolean)
    : [],
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Captain name is required");
  const rawTypes = Array.isArray(body?.employee_types) ? body.employee_types : [];
  const types = rawTypes
    .map((t) => String(t).trim())
    .filter((t) => VALID_TYPES.includes(t));
  return {
    name,
    date_of_joining: body?.date_of_joining || null,
    designation: String(body?.designation || "").trim() || null,
    address: String(body?.address || "").trim() || null,
    contact_number: String(body?.contact_number || "").trim() || null,
    employee_types: types.join(","),
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery("SELECT * FROM fb_captains ORDER BY id ASC");
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery("SELECT * FROM fb_captains WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO fb_captains
       (name, date_of_joining, designation, address, contact_number, employee_types, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      p.name, p.date_of_joining, p.designation, p.address,
      p.contact_number, p.employee_types, p.is_active,
    ],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE fb_captains SET
        name = ?, date_of_joining = ?, designation = ?, address = ?,
        contact_number = ?, employee_types = ?, is_active = ?
      WHERE id = ?`,
    [
      p.name, p.date_of_joining, p.designation, p.address,
      p.contact_number, p.employee_types, p.is_active, id,
    ],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_captains WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove, getById, VALID_TYPES };
