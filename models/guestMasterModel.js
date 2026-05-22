const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS guest_master (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      age INT DEFAULT NULL,
      gender VARCHAR(20) DEFAULT 'Male',
      address VARCHAR(500) DEFAULT NULL,
      mobile VARCHAR(50) DEFAULT NULL,
      alternate_mobile VARCHAR(50) DEFAULT NULL,
      email VARCHAR(191) DEFAULT NULL,
      nationality VARCHAR(100) DEFAULT 'INDIAN',
      company VARCHAR(255) DEFAULT NULL,
      company_gst VARCHAR(50) DEFAULT NULL,
      company_address VARCHAR(500) DEFAULT NULL,
      id_type VARCHAR(100) DEFAULT NULL,
      id_number VARCHAR(100) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mobile (mobile),
      INDEX idx_name (name)
    )
  `);
};

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Name is required");
  const ageRaw = body?.age;
  const age =
    ageRaw === undefined || ageRaw === null || ageRaw === ""
      ? null
      : Number(ageRaw);
  if (age !== null && Number.isNaN(age)) throw new Error("Age must be a number");
  return {
    name,
    age,
    gender: String(body?.gender || "Male").trim() || "Male",
    address: String(body?.address || "").trim() || null,
    mobile: String(body?.mobile || "").trim() || null,
    alternate_mobile: String(body?.alternate_mobile || "").trim() || null,
    email: String(body?.email || "").trim() || null,
    nationality: String(body?.nationality || "INDIAN").trim() || "INDIAN",
    company: String(body?.company || "").trim() || null,
    company_gst: String(body?.company_gst || "").trim() || null,
    company_address: String(body?.company_address || "").trim() || null,
    id_type: String(body?.id_type || "").trim() || null,
    id_number: String(body?.id_number || "").trim() || null,
  };
};

const listGuests = async ({ mobile = "", name = "" } = {}) => {
  const conditions = [];
  const params = [];
  if (mobile) {
    conditions.push("mobile LIKE ?");
    params.push(`%${mobile}%`);
  }
  if (name) {
    conditions.push("name LIKE ?");
    params.push(`%${name}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return runQuery(
    `SELECT * FROM guest_master ${where} ORDER BY id ASC`,
    params,
  );
};

const createGuest = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO guest_master
       (name, age, gender, address, mobile, alternate_mobile, email,
        nationality, company, company_gst, company_address, id_type, id_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.name, p.age, p.gender, p.address, p.mobile, p.alternate_mobile, p.email,
      p.nationality, p.company, p.company_gst, p.company_address, p.id_type, p.id_number,
    ],
  );
  return { id: result.insertId, ...p };
};

const updateGuest = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE guest_master
        SET name = ?, age = ?, gender = ?, address = ?, mobile = ?,
            alternate_mobile = ?, email = ?, nationality = ?, company = ?,
            company_gst = ?, company_address = ?, id_type = ?, id_number = ?
      WHERE id = ?`,
    [
      p.name, p.age, p.gender, p.address, p.mobile, p.alternate_mobile, p.email,
      p.nationality, p.company, p.company_gst, p.company_address, p.id_type, p.id_number,
      id,
    ],
  );
  return { id: Number(id), ...p };
};

const deleteGuest = async (id) => {
  await runQuery("DELETE FROM guest_master WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listGuests,
  createGuest,
  updateGuest,
  deleteGuest,
};
