const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = [
  "Room Tarrif",
  "Room Service",
  "Food",
  "GST",
  "Service Charge",
  "VAT",
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS tax_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM tax_categories");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const name of DEFAULTS) {
      await runQuery("INSERT INTO tax_categories (name) VALUES (?)", [name]);
    }
  }
};

const listTaxCategories = async () =>
  runQuery("SELECT id, name FROM tax_categories ORDER BY id ASC");

const createTaxCategory = async (name) => {
  const cleaned = String(name || "").trim();
  if (!cleaned) throw new Error("Name is required");
  const result = await runQuery(
    "INSERT INTO tax_categories (name) VALUES (?)",
    [cleaned],
  );
  return { id: result.insertId, name: cleaned };
};

const updateTaxCategory = async (id, name) => {
  const cleaned = String(name || "").trim();
  if (!cleaned) throw new Error("Name is required");
  await runQuery("UPDATE tax_categories SET name = ? WHERE id = ?", [cleaned, id]);
  return { id: Number(id), name: cleaned };
};

const deleteTaxCategory = async (id) => {
  await runQuery("DELETE FROM tax_categories WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listTaxCategories,
  createTaxCategory,
  updateTaxCategory,
  deleteTaxCategory,
};
