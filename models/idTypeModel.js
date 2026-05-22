const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = ["Aadhar Card", "Passport", "Driving License", "PAN CARD", "VOTER ID"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS id_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM id_types");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const name of DEFAULTS) {
      await runQuery("INSERT INTO id_types (name) VALUES (?)", [name]);
    }
  }
};

const listIdTypes = async () => {
  return runQuery("SELECT id, name FROM id_types ORDER BY id ASC");
};

const createIdType = async (name) => {
  const cleaned = String(name || "").trim();
  if (!cleaned) throw new Error("Name is required");
  const result = await runQuery("INSERT INTO id_types (name) VALUES (?)", [cleaned]);
  return { id: result.insertId, name: cleaned };
};

const updateIdType = async (id, name) => {
  const cleaned = String(name || "").trim();
  if (!cleaned) throw new Error("Name is required");
  await runQuery("UPDATE id_types SET name = ? WHERE id = ?", [cleaned, id]);
  return { id: Number(id), name: cleaned };
};

const deleteIdType = async (id) => {
  await runQuery("DELETE FROM id_types WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listIdTypes,
  createIdType,
  updateIdType,
  deleteIdType,
};
