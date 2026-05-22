const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = ["Kitchen KOT", "Bar KOT", "Reception", "Hall"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_print_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      printer_location_id INT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (printer_location_id) REFERENCES printer_locations(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_print_groups");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const name of DEFAULTS) {
      await runQuery("INSERT INTO fb_print_groups (name) VALUES (?)", [name]);
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  printer_location_id: r.printer_location_id,
  printer_location_name: r.printer_location_name || "",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Print group name is required");
  return {
    name,
    printer_location_id: body?.printer_location_id ? Number(body.printer_location_id) : null,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery(`
    SELECT g.*, pl.name AS printer_location_name
      FROM fb_print_groups g
      LEFT JOIN printer_locations pl ON pl.id = g.printer_location_id
      ORDER BY g.id ASC
  `);
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fb_print_groups (name, printer_location_id, is_active) VALUES (?, ?, ?)",
    [p.name, p.printer_location_id, p.is_active],
  );
  const rows = await runQuery(
    `SELECT g.*, pl.name AS printer_location_name
       FROM fb_print_groups g LEFT JOIN printer_locations pl ON pl.id = g.printer_location_id
      WHERE g.id = ?`,
    [result.insertId],
  );
  return mapRow(rows[0]);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE fb_print_groups SET name = ?, printer_location_id = ?, is_active = ? WHERE id = ?",
    [p.name, p.printer_location_id, p.is_active, id],
  );
  const rows = await runQuery(
    `SELECT g.*, pl.name AS printer_location_name
       FROM fb_print_groups g LEFT JOIN printer_locations pl ON pl.id = g.printer_location_id
      WHERE g.id = ?`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_print_groups WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
