const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = [
  { name: "Food", tax: "GST 5%" },
  { name: "GST 5%", tax: "GST 5%" },
  { name: "GST 18%", tax: "GST 18%" },
  { name: "Quick Sales", tax: "GST 5%" },
  { name: "MISC", tax: "NO TAX" },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_invoice_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      tax_setting_id INT DEFAULT NULL,
      default_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tax_setting_id) REFERENCES tax_settings(id) ON DELETE SET NULL
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_invoice_groups");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const taxes = await runQuery("SELECT id, name FROM tax_settings");
    const taxMap = new Map(taxes.map((t) => [t.name, t.id]));
    for (const row of DEFAULTS) {
      await runQuery(
        "INSERT INTO fb_invoice_groups (name, tax_setting_id, default_discount) VALUES (?, ?, 0)",
        [row.name, taxMap.get(row.tax) || null],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  tax_setting_id: r.tax_setting_id,
  tax_setting_name: r.tax_setting_name || "",
  default_discount: Number(r.default_discount) || 0,
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Invoice group name is required");
  const discount = Number(body?.default_discount || 0);
  if (Number.isNaN(discount) || discount < 0) {
    throw new Error("Default discount must be a non-negative number");
  }
  return {
    name,
    tax_setting_id: body?.tax_setting_id ? Number(body.tax_setting_id) : null,
    default_discount: discount,
  };
};

const list = async () => {
  const rows = await runQuery(`
    SELECT g.*, ts.name AS tax_setting_name
      FROM fb_invoice_groups g
      LEFT JOIN tax_settings ts ON ts.id = g.tax_setting_id
      ORDER BY g.id ASC
  `);
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO fb_invoice_groups (name, tax_setting_id, default_discount) VALUES (?, ?, ?)",
    [p.name, p.tax_setting_id, p.default_discount],
  );
  const rows = await runQuery(
    `SELECT g.*, ts.name AS tax_setting_name
       FROM fb_invoice_groups g LEFT JOIN tax_settings ts ON ts.id = g.tax_setting_id
      WHERE g.id = ?`,
    [result.insertId],
  );
  return mapRow(rows[0]);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE fb_invoice_groups
        SET name = ?, tax_setting_id = ?, default_discount = ?
      WHERE id = ?`,
    [p.name, p.tax_setting_id, p.default_discount, id],
  );
  const rows = await runQuery(
    `SELECT g.*, ts.name AS tax_setting_name
       FROM fb_invoice_groups g LEFT JOIN tax_settings ts ON ts.id = g.tax_setting_id
      WHERE g.id = ?`,
    [id],
  );
  return rows[0] ? mapRow(rows[0]) : null;
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_invoice_groups WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
