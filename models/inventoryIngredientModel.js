const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const columnExists = async (column) => {
  const rows = await runQuery(
    "SHOW COLUMNS FROM inventory_ingredients LIKE ?",
    [column],
  );
  return Array.isArray(rows) && rows.length > 0;
};

const addColumnIfMissing = async (column, definition) => {
  if (!(await columnExists(column))) {
    await runQuery(
      `ALTER TABLE inventory_ingredients ADD COLUMN ${column} ${definition}`,
    );
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await addColumnIfMissing("item_group_id", "INT DEFAULT NULL");
  await addColumnIfMissing("item_code", "VARCHAR(64) DEFAULT NULL");
  await addColumnIfMissing("unit_id", "INT DEFAULT NULL");
  await addColumnIfMissing("current_stock", "DECIMAL(12,3) NOT NULL DEFAULT 0");
  await addColumnIfMissing("reorder_level", "DECIMAL(12,3) NOT NULL DEFAULT 0");
  await addColumnIfMissing("avg_rate", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await addColumnIfMissing("vendor_id", "INT DEFAULT NULL");
  await addColumnIfMissing("is_active", "TINYINT(1) NOT NULL DEFAULT 1");
};

const mapRow = (r) => ({
  id: r.id,
  item_group_id: r.item_group_id,
  item_group_name: r.item_group_name || "",
  item_code: r.item_code || "",
  name: r.name || "",
  unit_id: r.unit_id,
  unit_name: r.unit_name || "",
  current_stock: Number(r.current_stock || 0),
  reorder_level: Number(r.reorder_level || 0),
  avg_rate: Number(r.avg_rate || 0),
  vendor_id: r.vendor_id,
  vendor_name: r.vendor_name || "",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Ingredient name is required");
  return {
    item_group_id: body?.item_group_id ? Number(body.item_group_id) : null,
    item_code: String(body?.item_code || "").trim() || null,
    name,
    unit_id: body?.unit_id ? Number(body.unit_id) : null,
    current_stock: Number(body?.current_stock) || 0,
    reorder_level: Number(body?.reorder_level) || 0,
    avg_rate: Number(body?.avg_rate) || 0,
    vendor_id: body?.vendor_id ? Number(body.vendor_id) : null,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const baseSelect = `
  SELECT ig.*,
         g.name AS item_group_name,
         u.name AS unit_name,
         v.name AS vendor_name
    FROM inventory_ingredients ig
    LEFT JOIN fb_item_groups g ON g.id = ig.item_group_id
    LEFT JOIN fb_units u ON u.id = ig.unit_id
    LEFT JOIN inventory_vendors v ON v.id = ig.vendor_id
`;

const list = async ({ item_group_id = "", item_code = "", name = "" } = {}) => {
  const where = [];
  const params = [];
  if (item_group_id) { where.push("ig.item_group_id = ?"); params.push(Number(item_group_id)); }
  if (item_code)     { where.push("ig.item_code LIKE ?"); params.push(`%${item_code}%`); }
  if (name)          { where.push("ig.name LIKE ?");      params.push(`%${name}%`); }

  const rows = await runQuery(
    `${baseSelect} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ig.id ASC`,
    params,
  );
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery(`${baseSelect} WHERE ig.id = ?`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO inventory_ingredients
       (item_group_id, item_code, name, unit_id, current_stock, reorder_level, avg_rate, vendor_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.item_group_id, p.item_code, p.name, p.unit_id, p.current_stock, p.reorder_level, p.avg_rate, p.vendor_id, p.is_active],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE inventory_ingredients SET
       item_group_id = ?, item_code = ?, name = ?, unit_id = ?,
       current_stock = ?, reorder_level = ?, avg_rate = ?, vendor_id = ?, is_active = ?
     WHERE id = ?`,
    [p.item_group_id, p.item_code, p.name, p.unit_id, p.current_stock, p.reorder_level, p.avg_rate, p.vendor_id, p.is_active, id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM inventory_ingredients WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, getById, create, update, remove };
