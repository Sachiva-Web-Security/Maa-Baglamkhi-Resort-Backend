const crypto = require("crypto");
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const newCode = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS terminals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      code VARCHAR(64) NOT NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM terminals");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const defaults = ["UrbanPOS", "Terminal 2", "Terminal 3"];
    for (const name of defaults) {
      await runQuery(
        "INSERT INTO terminals (name, code, is_active) VALUES (?, ?, 1)",
        [name, newCode()],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  code: r.code || "",
  is_active: Number(r.is_active) === 1,
});

const listTerminals = async () => {
  const rows = await runQuery("SELECT * FROM terminals ORDER BY id ASC");
  return rows.map(mapRow);
};

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Terminal name is required");
  return {
    name,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const createTerminal = async (body) => {
  const p = sanitize(body);
  const code = newCode();
  const result = await runQuery(
    "INSERT INTO terminals (name, code, is_active) VALUES (?, ?, ?)",
    [p.name, code, p.is_active],
  );
  return { id: result.insertId, name: p.name, code, is_active: !!p.is_active };
};

const updateTerminal = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE terminals SET name = ?, is_active = ? WHERE id = ?",
    [p.name, p.is_active, id],
  );
  const rows = await runQuery("SELECT * FROM terminals WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const deleteTerminal = async (id) => {
  await runQuery("DELETE FROM terminals WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listTerminals,
  createTerminal,
  updateTerminal,
  deleteTerminal,
};
