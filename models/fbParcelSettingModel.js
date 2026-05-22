const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_parcel_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      price_group_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (price_group_id) REFERENCES fb_price_groups(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_parcel_settings");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const qsr = await runQuery(
      "SELECT id FROM fb_price_groups WHERE name = 'QSR' LIMIT 1",
    );
    await runQuery(
      "INSERT INTO fb_parcel_settings (price_group_id) VALUES (?)",
      [qsr?.[0]?.id || null],
    );
  }
};

const mapRow = (r) => ({
  id: r.id,
  price_group_id: r.price_group_id,
  price_group_name: r.price_group_name || "",
});

const get = async () => {
  const rows = await runQuery(`
    SELECT s.*, pg.name AS price_group_name
      FROM fb_parcel_settings s
      LEFT JOIN fb_price_groups pg ON pg.id = s.price_group_id
      ORDER BY s.id ASC
      LIMIT 1
  `);
  return rows[0] ? mapRow(rows[0]) : { id: null, price_group_id: null, price_group_name: "" };
};

const save = async (body) => {
  const price_group_id = body?.price_group_id ? Number(body.price_group_id) : null;
  const rows = await runQuery("SELECT id FROM fb_parcel_settings ORDER BY id ASC LIMIT 1");
  if (rows[0]) {
    await runQuery(
      "UPDATE fb_parcel_settings SET price_group_id = ? WHERE id = ?",
      [price_group_id, rows[0].id],
    );
  } else {
    await runQuery(
      "INSERT INTO fb_parcel_settings (price_group_id) VALUES (?)",
      [price_group_id],
    );
  }
  return get();
};

module.exports = { ensureSchema, get, save };
