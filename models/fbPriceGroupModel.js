const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_price_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      discount_on_total DECIMAL(10,2) NOT NULL DEFAULT 0,
      online_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_price_groups");
  if (Number(rows?.[0]?.count || 0) === 0) {
    await runQuery(
      "INSERT INTO fb_price_groups (name, discount_on_total, online_discount) VALUES (?, 0, 0)",
      ["QSR"],
    );
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  discount_on_total: Number(r.discount_on_total) || 0,
  online_discount: Number(r.online_discount) || 0,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Price group name is required");
  const dot = Number(body?.discount_on_total || 0);
  const od = Number(body?.online_discount || 0);
  if (Number.isNaN(dot) || dot < 0) throw new Error("Discount on Total must be a non-negative number");
  if (Number.isNaN(od) || od < 0) throw new Error("Online Discount must be a non-negative number");
  return { name, discount_on_total: dot, online_discount: od };
};

const list = async () => {
  const rows = await runQuery("SELECT * FROM fb_price_groups ORDER BY id ASC");
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fb_price_groups (name, discount_on_total, online_discount) VALUES (?, ?, ?)",
    [p.name, p.discount_on_total, p.online_discount],
  );
  return { id: result.insertId, ...p };
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE fb_price_groups SET name = ?, discount_on_total = ?, online_discount = ? WHERE id = ?",
    [p.name, p.discount_on_total, p.online_discount, id],
  );
  return { id: Number(id), ...p };
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_price_groups WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
