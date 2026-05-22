const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = ["RESTAURANT", "GARDEN", "PARSAL", "ROOM DINING"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_table_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      price_group_id INT DEFAULT NULL,
      terminal_id INT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (price_group_id) REFERENCES fb_price_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_table_groups");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const qsr = await runQuery(
      "SELECT id FROM fb_price_groups WHERE name = 'QSR' LIMIT 1",
    );
    const qsrId = qsr?.[0]?.id || null;
    for (const name of DEFAULTS) {
      await runQuery(
        "INSERT INTO fb_table_groups (name, price_group_id) VALUES (?, ?)",
        [name, qsrId],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  price_group_id: r.price_group_id,
  price_group_name: r.price_group_name || "",
  terminal_id: r.terminal_id,
  terminal_name: r.terminal_name || "",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Table group name is required");
  return {
    name,
    price_group_id: body?.price_group_id ? Number(body.price_group_id) : null,
    terminal_id: body?.terminal_id ? Number(body.terminal_id) : null,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const baseSelect = `
  SELECT tg.*,
         pg.name AS price_group_name,
         t.name AS terminal_name
    FROM fb_table_groups tg
    LEFT JOIN fb_price_groups pg ON pg.id = tg.price_group_id
    LEFT JOIN terminals t ON t.id = tg.terminal_id
`;

const list = async () => {
  const rows = await runQuery(`${baseSelect} ORDER BY tg.id ASC`);
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery(`${baseSelect} WHERE tg.id = ?`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fb_table_groups (name, price_group_id, terminal_id, is_active) VALUES (?, ?, ?, ?)",
    [p.name, p.price_group_id, p.terminal_id, p.is_active],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE fb_table_groups SET name = ?, price_group_id = ?, terminal_id = ?, is_active = ? WHERE id = ?",
    [p.name, p.price_group_id, p.terminal_id, p.is_active, id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_table_groups WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove, getById };
