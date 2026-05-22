const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = [
  "Microsoft Print to PDF",
  "Kitchen",
  "Microsoft XPS Document Writer",
  "Hall Printer",
  "EPSONTEST",
  "Main",
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS printer_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM printer_locations");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const name of DEFAULTS) {
      await runQuery("INSERT INTO printer_locations (name) VALUES (?)", [name]);
    }
  }
};

const list = async () =>
  runQuery("SELECT id, name FROM printer_locations ORDER BY id ASC");

const create = async (name) => {
  const cleaned = String(name || "").trim();
  if (!cleaned) throw new Error("Name is required");
  const result = await runQuery(
    "INSERT INTO printer_locations (name) VALUES (?)",
    [cleaned],
  );
  return { id: result.insertId, name: cleaned };
};

const update = async (id, name) => {
  const cleaned = String(name || "").trim();
  if (!cleaned) throw new Error("Name is required");
  await runQuery("UPDATE printer_locations SET name = ? WHERE id = ?", [
    cleaned,
    id,
  ]);
  return { id: Number(id), name: cleaned };
};

const remove = async (id) => {
  await runQuery("DELETE FROM printer_locations WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
