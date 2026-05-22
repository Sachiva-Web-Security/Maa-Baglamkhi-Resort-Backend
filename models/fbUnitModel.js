const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = [
  "KG",
  "Plate",
  "Nos",
  "Ltr",
  "1000 ML Bottle",
  "Packet",
  "Glass",
  "750 Ml Bottle",
  "Gms",
  "Pcs.",
  "ML",
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_units (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_units");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const name of DEFAULTS) {
      await runQuery("INSERT INTO fb_units (name) VALUES (?)", [name]);
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Unit name is required");
  return {
    name,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery("SELECT * FROM fb_units ORDER BY id ASC");
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery("SELECT * FROM fb_units WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fb_units (name, is_active) VALUES (?, ?)",
    [p.name, p.is_active],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE fb_units SET name = ?, is_active = ? WHERE id = ?",
    [p.name, p.is_active, id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_units WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove, getById };
