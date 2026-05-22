const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = [
  { name: "GST 0",          category: "Room Tarrif",     from: 0,    to: 0,       pct: 0  },
  { name: "GST 12",         category: "Room Tarrif",     from: 0,    to: 7499,    pct: 5  },
  { name: "GST 18",         category: "Room Tarrif",     from: 7500, to: 100000,  pct: 18 },
  { name: "Service Charges",category: "Service Charge",  from: 1,    to: 1000000, pct: 5  },
  { name: "VAT",            category: "VAT",             from: 1,    to: 100000,  pct: 18 },
  { name: "GST 5%",         category: "GST",             from: 1,    to: 100000,  pct: 5  },
  { name: "GST 18%",        category: "GST",             from: 1,    to: 100000,  pct: 18 },
  { name: "NO TAX",         category: "GST",             from: 0,    to: 0,       pct: 0  },
  { name: "GST 12%",        category: "GST",             from: 1,    to: 100000,  pct: 12 },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS tax_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      tax_category_id INT DEFAULT NULL,
      range_from DECIMAL(15,2) NOT NULL DEFAULT 0,
      range_to DECIMAL(15,2) NOT NULL DEFAULT 0,
      tax_percent DECIMAL(7,3) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM tax_settings");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const cats = await runQuery("SELECT id, name FROM tax_categories");
    const catMap = new Map(cats.map((c) => [c.name, c.id]));
    for (const row of DEFAULTS) {
      await runQuery(
        `INSERT INTO tax_settings (name, tax_category_id, range_from, range_to, tax_percent)
         VALUES (?, ?, ?, ?, ?)`,
        [row.name, catMap.get(row.category) || null, row.from, row.to, row.pct],
      );
    }
  }
};

const listTaxSettings = async () => {
  const rows = await runQuery(`
    SELECT ts.id, ts.name, ts.tax_category_id,
           tc.name AS tax_category_name,
           ts.range_from, ts.range_to, ts.tax_percent
    FROM tax_settings ts
    LEFT JOIN tax_categories tc ON tc.id = ts.tax_category_id
    ORDER BY ts.id ASC
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    tax_category_id: r.tax_category_id,
    tax_category_name: r.tax_category_name || "",
    range_from: Number(r.range_from),
    range_to: Number(r.range_to),
    tax_percent: Number(r.tax_percent),
  }));
};

const sanitizePayload = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Tax setting name is required");
  const tax_category_id = body?.tax_category_id ? Number(body.tax_category_id) : null;
  const range_from = Number(body?.range_from || 0);
  const range_to = Number(body?.range_to || 0);
  const tax_percent = Number(body?.tax_percent || 0);
  if (Number.isNaN(range_from) || Number.isNaN(range_to) || Number.isNaN(tax_percent)) {
    throw new Error("Numeric fields must be valid numbers");
  }
  if (range_to && range_to < range_from) {
    throw new Error("Range To must be greater than or equal to Range From");
  }
  return { name, tax_category_id, range_from, range_to, tax_percent };
};

const createTaxSetting = async (body) => {
  const p = sanitizePayload(body);
  const result = await runQuery(
    `INSERT INTO tax_settings (name, tax_category_id, range_from, range_to, tax_percent)
     VALUES (?, ?, ?, ?, ?)`,
    [p.name, p.tax_category_id, p.range_from, p.range_to, p.tax_percent],
  );
  return { id: result.insertId, ...p };
};

const updateTaxSetting = async (id, body) => {
  const p = sanitizePayload(body);
  await runQuery(
    `UPDATE tax_settings
        SET name = ?, tax_category_id = ?, range_from = ?, range_to = ?, tax_percent = ?
      WHERE id = ?`,
    [p.name, p.tax_category_id, p.range_from, p.range_to, p.tax_percent, id],
  );
  return { id: Number(id), ...p };
};

const deleteTaxSetting = async (id) => {
  await runQuery("DELETE FROM tax_settings WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listTaxSettings,
  createTaxSetting,
  updateTaxSetting,
  deleteTaxSetting,
};
