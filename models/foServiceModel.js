const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = ["Food", "Laundry", "Pick Up", "Drop Off", "Car Rent", "Mini Bar", "ROOM FOOD"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fo_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      tax_setting_id INT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tax_setting_id) REFERENCES tax_settings(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fo_services");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const name of DEFAULTS) {
      await runQuery("INSERT INTO fo_services (name) VALUES (?)", [name]);
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  tax_setting_id: r.tax_setting_id,
  tax_setting_name: r.tax_setting_name || "",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Service name is required");
  return {
    name,
    tax_setting_id: body?.tax_setting_id ? Number(body.tax_setting_id) : null,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery(`
    SELECT s.*, ts.name AS tax_setting_name
      FROM fo_services s
      LEFT JOIN tax_settings ts ON ts.id = s.tax_setting_id
      ORDER BY s.id ASC
  `);
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fo_services (name, tax_setting_id, is_active) VALUES (?, ?, ?)",
    [p.name, p.tax_setting_id, p.is_active],
  );
  const rows = await runQuery(
    `SELECT s.*, ts.name AS tax_setting_name
       FROM fo_services s LEFT JOIN tax_settings ts ON ts.id = s.tax_setting_id
      WHERE s.id = ?`,
    [result.insertId],
  );
  return mapRow(rows[0]);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE fo_services SET name = ?, tax_setting_id = ?, is_active = ? WHERE id = ?",
    [p.name, p.tax_setting_id, p.is_active, id],
  );
  const rows = await runQuery(
    `SELECT s.*, ts.name AS tax_setting_name
       FROM fo_services s LEFT JOIN tax_settings ts ON ts.id = s.tax_setting_id
      WHERE s.id = ?`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const remove = async (id) => {
  await runQuery("DELETE FROM fo_services WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
