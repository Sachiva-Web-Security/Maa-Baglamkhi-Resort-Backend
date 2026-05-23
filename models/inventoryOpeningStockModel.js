const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_opening_stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stock_location_id INT DEFAULT NULL,
      ingredient_id INT NOT NULL,
      qty DECIMAL(12,3) NOT NULL DEFAULT 0,
      rate DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_value DECIMAL(14,2) NOT NULL DEFAULT 0,
      entry_date DATE NOT NULL,
      notes VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (stock_location_id) REFERENCES inventory_stock_locations(id) ON DELETE SET NULL,
      FOREIGN KEY (ingredient_id) REFERENCES inventory_ingredients(id) ON DELETE CASCADE
    )
  `);
};

const mapRow = (r) => ({
  id: r.id,
  stock_location_id: r.stock_location_id,
  stock_location_name: r.stock_location_name || "",
  ingredient_id: r.ingredient_id,
  ingredient_name: r.ingredient_name || "",
  item_group_id: r.item_group_id,
  item_group_name: r.item_group_name || "",
  unit_name: r.unit_name || "",
  qty: Number(r.qty || 0),
  rate: Number(r.rate || 0),
  total_value: Number(r.total_value || 0),
  entry_date: r.entry_date,
  notes: r.notes || "",
});

const sanitize = (body) => {
  const ingredient_id = Number(body?.ingredient_id);
  if (!ingredient_id) throw new Error("Ingredient is required");
  const qty = Number(body?.qty) || 0;
  const rate = Number(body?.rate) || 0;
  const total_value = body?.total_value != null
    ? Number(body.total_value)
    : Number((qty * rate).toFixed(2));
  return {
    stock_location_id: body?.stock_location_id ? Number(body.stock_location_id) : null,
    ingredient_id,
    qty,
    rate,
    total_value,
    entry_date: body?.entry_date || new Date().toISOString().slice(0, 10),
    notes: String(body?.notes || "").trim() || null,
  };
};

const baseSelect = `
  SELECT os.*,
         sl.name AS stock_location_name,
         ig.name AS ingredient_name,
         ig.item_group_id,
         g.name AS item_group_name,
         u.name AS unit_name
    FROM inventory_opening_stock os
    LEFT JOIN inventory_stock_locations sl ON sl.id = os.stock_location_id
    LEFT JOIN inventory_ingredients ig ON ig.id = os.ingredient_id
    LEFT JOIN fb_item_groups g ON g.id = ig.item_group_id
    LEFT JOIN fb_units u ON u.id = ig.unit_id
`;

const list = async ({ stock_location_id = "", item_group_id = "", name = "" } = {}) => {
  const where = [];
  const params = [];
  if (stock_location_id) { where.push("os.stock_location_id = ?"); params.push(Number(stock_location_id)); }
  if (item_group_id)     { where.push("ig.item_group_id = ?"); params.push(Number(item_group_id)); }
  if (name)              { where.push("ig.name LIKE ?"); params.push(`%${name}%`); }

  const rows = await runQuery(
    `${baseSelect} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY os.id DESC`,
    params,
  );
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery(`${baseSelect} WHERE os.id = ?`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO inventory_opening_stock
       (stock_location_id, ingredient_id, qty, rate, total_value, entry_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.stock_location_id, p.ingredient_id, p.qty, p.rate, p.total_value, p.entry_date, p.notes],
  );
  // Push the opening qty to ingredient's current_stock (set to qty)
  await runQuery(
    "UPDATE inventory_ingredients SET current_stock = ? WHERE id = ?",
    [p.qty, p.ingredient_id],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE inventory_opening_stock SET
       stock_location_id = ?, ingredient_id = ?, qty = ?, rate = ?,
       total_value = ?, entry_date = ?, notes = ?
     WHERE id = ?`,
    [p.stock_location_id, p.ingredient_id, p.qty, p.rate, p.total_value, p.entry_date, p.notes, id],
  );
  await runQuery(
    "UPDATE inventory_ingredients SET current_stock = ? WHERE id = ?",
    [p.qty, p.ingredient_id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM inventory_opening_stock WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, getById, create, update, remove };
