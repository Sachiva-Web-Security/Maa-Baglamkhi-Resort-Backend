const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS branches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      address1 VARCHAR(255) DEFAULT NULL,
      address2 VARCHAR(255) DEFAULT NULL,
      mobile1 VARCHAR(50) DEFAULT NULL,
      landline1 VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM branches");
  if (Number(rows?.[0]?.count || 0) === 0) {
    await runQuery(
      `INSERT INTO branches (name, address1, address2, mobile1, landline1)
       VALUES (?, ?, ?, ?, ?)`,
      [
        "MAA BAGLAMUKHI RESORT",
        "Maa Baglamukhi Mandir Raod",
        "Nalkhada",
        "9522238777",
        null,
      ],
    );
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  address1: r.address1 || "",
  address2: r.address2 || "",
  mobile1: r.mobile1 || "",
  landline1: r.landline1 || "",
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Branch name is required");
  return {
    name,
    address1: String(body?.address1 || "").trim() || null,
    address2: String(body?.address2 || "").trim() || null,
    mobile1: String(body?.mobile1 || "").trim() || null,
    landline1: String(body?.landline1 || "").trim() || null,
  };
};

const list = async () => {
  const rows = await runQuery("SELECT * FROM branches ORDER BY id ASC");
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO branches (name, address1, address2, mobile1, landline1)
     VALUES (?, ?, ?, ?, ?)`,
    [p.name, p.address1, p.address2, p.mobile1, p.landline1],
  );
  return { id: result.insertId, ...p };
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE branches
        SET name = ?, address1 = ?, address2 = ?, mobile1 = ?, landline1 = ?
      WHERE id = ?`,
    [p.name, p.address1, p.address2, p.mobile1, p.landline1, id],
  );
  return { id: Number(id), ...p };
};

const remove = async (id) => {
  await runQuery("DELETE FROM branches WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
