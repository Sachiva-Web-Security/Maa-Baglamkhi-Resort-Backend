const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const columnExists = async (column) => {
  const rows = await runQuery(
    "SHOW COLUMNS FROM inventory_item_groups LIKE ?",
    [column],
  );
  return Array.isArray(rows) && rows.length > 0;
};

const addColumnIfMissing = async (column, definition) => {
  if (!(await columnExists(column))) {
    await runQuery(
      `ALTER TABLE inventory_item_groups ADD COLUMN ${column} ${definition}`,
    );
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_item_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  // Migrate older schemas — these add columns only if missing.
  await addColumnIfMissing("description", "VARCHAR(255) DEFAULT NULL");
  await addColumnIfMissing("parent_id", "INT DEFAULT NULL");
  await addColumnIfMissing("is_active", "TINYINT(1) NOT NULL DEFAULT 1");
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  description: r.description || "",
  parent_id: r.parent_id,
  parent_name: r.parent_name || "",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Group name is required");
  return {
    name,
    description: String(body?.description || "").trim() || null,
    parent_id: body?.parent_id ? Number(body.parent_id) : null,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const baseSelect = `
  SELECT g.*, p.name AS parent_name
    FROM inventory_item_groups g
    LEFT JOIN inventory_item_groups p ON p.id = g.parent_id
`;

const list = async ({ name = "" } = {}) => {
  const where = [];
  const params = [];
  if (name) {
    where.push("g.name LIKE ?");
    params.push(`%${name}%`);
  }
  const rows = await runQuery(
    `${baseSelect} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY g.id ASC`,
    params,
  );
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery(`${baseSelect} WHERE g.id = ?`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO inventory_item_groups (name, description, parent_id, is_active) VALUES (?, ?, ?, ?)",
    [p.name, p.description, p.parent_id, p.is_active],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE inventory_item_groups SET name = ?, description = ?, parent_id = ?, is_active = ? WHERE id = ?",
    [p.name, p.description, p.parent_id, p.is_active, id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM inventory_item_groups WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, getById, create, update, remove };
