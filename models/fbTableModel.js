const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const SEEDS = [
  { group: "RESTAURANT", tables: ["T1", "T2", "T3", "T4", "T5", "T6"], capacity: 4 },
  { group: "GARDEN",     tables: ["G1", "G2", "G3", "G4"],             capacity: 6 },
  { group: "PARSAL",     tables: ["P1", "P2"],                          capacity: 2 },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_group_id INT DEFAULT NULL,
      name VARCHAR(64) NOT NULL,
      capacity INT NOT NULL DEFAULT 4,
      status VARCHAR(16) NOT NULL DEFAULT 'available',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_group_name (table_group_id, name),
      FOREIGN KEY (table_group_id) REFERENCES fb_table_groups(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_tables");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const s of SEEDS) {
      const g = await runQuery(
        "SELECT id FROM fb_table_groups WHERE name = ? LIMIT 1",
        [s.group],
      );
      const groupId = g?.[0]?.id || null;
      if (!groupId) continue;
      for (const name of s.tables) {
        await runQuery(
          "INSERT IGNORE INTO fb_tables (table_group_id, name, capacity, status) VALUES (?, ?, ?, 'available')",
          [groupId, name, s.capacity],
        );
      }
    }
  }
};

const STATUSES = ["available", "occupied", "reserved"];

const mapRow = (r) => ({
  id: r.id,
  table_group_id: r.table_group_id,
  table_group_name: r.table_group_name || "",
  name: r.name || "",
  capacity: Number(r.capacity || 0),
  status: r.status || "available",
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Table name/number is required");
  const status = STATUSES.includes(body?.status) ? body.status : "available";
  const capacity = Number(body?.capacity);
  return {
    table_group_id: body?.table_group_id ? Number(body.table_group_id) : null,
    name,
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 4,
    status,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const baseSelect = `
  SELECT t.*, tg.name AS table_group_name
    FROM fb_tables t
    LEFT JOIN fb_table_groups tg ON tg.id = t.table_group_id
`;

const list = async ({ table_group_id = "" } = {}) => {
  const where = [];
  const params = [];
  if (table_group_id) {
    where.push("t.table_group_id = ?");
    params.push(Number(table_group_id));
  }
  const rows = await runQuery(
    `${baseSelect} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY t.table_group_id ASC, t.id ASC`,
    params,
  );
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery(`${baseSelect} WHERE t.id = ?`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fb_tables (table_group_id, name, capacity, status, is_active) VALUES (?, ?, ?, ?, ?)",
    [p.table_group_id, p.name, p.capacity, p.status, p.is_active],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE fb_tables SET table_group_id = ?, name = ?, capacity = ?, status = ?, is_active = ? WHERE id = ?",
    [p.table_group_id, p.name, p.capacity, p.status, p.is_active, id],
  );
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_tables WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove, getById };
