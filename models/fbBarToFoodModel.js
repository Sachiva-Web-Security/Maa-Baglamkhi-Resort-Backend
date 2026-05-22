const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_bar_to_food_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bar_invoice_group_id INT DEFAULT NULL,
      food_invoice_group_id INT DEFAULT NULL,
      auto_transfer_on_settle TINYINT(1) NOT NULL DEFAULT 0,
      merge_into_single_invoice TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (bar_invoice_group_id) REFERENCES fb_invoice_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (food_invoice_group_id) REFERENCES fb_invoice_groups(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_bar_to_food_settings");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const food = await runQuery("SELECT id FROM fb_invoice_groups WHERE name = 'Food' LIMIT 1");
    const bar = await runQuery("SELECT id FROM fb_invoice_groups WHERE name = 'Bar' LIMIT 1");
    await runQuery(
      `INSERT INTO fb_bar_to_food_settings
         (bar_invoice_group_id, food_invoice_group_id, auto_transfer_on_settle, merge_into_single_invoice)
       VALUES (?, ?, 0, 1)`,
      [bar?.[0]?.id || null, food?.[0]?.id || null],
    );
  }
};

const mapRow = (r) => ({
  id: r.id,
  bar_invoice_group_id: r.bar_invoice_group_id,
  bar_invoice_group_name: r.bar_invoice_group_name || "",
  food_invoice_group_id: r.food_invoice_group_id,
  food_invoice_group_name: r.food_invoice_group_name || "",
  auto_transfer_on_settle: Number(r.auto_transfer_on_settle) === 1,
  merge_into_single_invoice: Number(r.merge_into_single_invoice) === 1,
});

const get = async () => {
  const rows = await runQuery(`
    SELECT s.*,
           b.name AS bar_invoice_group_name,
           f.name AS food_invoice_group_name
      FROM fb_bar_to_food_settings s
      LEFT JOIN fb_invoice_groups b ON b.id = s.bar_invoice_group_id
      LEFT JOIN fb_invoice_groups f ON f.id = s.food_invoice_group_id
      ORDER BY s.id ASC LIMIT 1
  `);
  return rows[0] ? mapRow(rows[0]) : null;
};

const save = async (body) => {
  const exists = await runQuery("SELECT id FROM fb_bar_to_food_settings ORDER BY id ASC LIMIT 1");
  const bar_id = body?.bar_invoice_group_id ? Number(body.bar_invoice_group_id) : null;
  const food_id = body?.food_invoice_group_id ? Number(body.food_invoice_group_id) : null;
  const auto = body?.auto_transfer_on_settle ? 1 : 0;
  const merge = body?.merge_into_single_invoice ? 1 : 0;
  if (exists[0]) {
    await runQuery(
      `UPDATE fb_bar_to_food_settings SET
         bar_invoice_group_id = ?, food_invoice_group_id = ?,
         auto_transfer_on_settle = ?, merge_into_single_invoice = ?
       WHERE id = ?`,
      [bar_id, food_id, auto, merge, exists[0].id],
    );
  } else {
    await runQuery(
      `INSERT INTO fb_bar_to_food_settings
         (bar_invoice_group_id, food_invoice_group_id, auto_transfer_on_settle, merge_into_single_invoice)
       VALUES (?, ?, ?, ?)`,
      [bar_id, food_id, auto, merge],
    );
  }
  return get();
};

module.exports = { ensureSchema, get, save };
