const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const SEEDS = [
  { name: "Extra Cheese",   price_add: 20, modifier_group: "Add-on" },
  { name: "Extra Cream",    price_add: 15, modifier_group: "Add-on" },
  { name: "No Onion",       price_add: 0,  modifier_group: "Preference" },
  { name: "No Garlic",      price_add: 0,  modifier_group: "Preference" },
  { name: "Extra Spicy",    price_add: 0,  modifier_group: "Spice" },
  { name: "Less Spicy",     price_add: 0,  modifier_group: "Spice" },
  { name: "Extra Sauce",    price_add: 10, modifier_group: "Add-on" },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_modifiers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      modifier_group VARCHAR(64) DEFAULT NULL,
      price_add DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_modifiers");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const s of SEEDS) {
      await runQuery(
        "INSERT INTO fb_modifiers (name, modifier_group, price_add) VALUES (?, ?, ?)",
        [s.name, s.modifier_group, s.price_add],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  modifier_group: r.modifier_group || "",
  price_add: Number(r.price_add || 0),
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Modifier name is required");
  return {
    name,
    modifier_group: String(body?.modifier_group || "").trim() || null,
    price_add: Number(body?.price_add) || 0,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery("SELECT * FROM fb_modifiers ORDER BY id ASC");
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery("SELECT * FROM fb_modifiers WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fb_modifiers (name, modifier_group, price_add, is_active) VALUES (?, ?, ?, ?)",
    [p.name, p.modifier_group, p.price_add, p.is_active],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE fb_modifiers SET name = ?, modifier_group = ?, price_add = ?, is_active = ? WHERE id = ?",
    [p.name, p.modifier_group, p.price_add, p.is_active, id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_modifiers WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove, getById };
