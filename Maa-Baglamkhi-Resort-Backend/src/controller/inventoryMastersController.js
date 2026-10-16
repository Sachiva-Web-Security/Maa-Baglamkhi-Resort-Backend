const db = require("../config/db");
const { ensureSchema: ensureInventoryCategoriesSchema } = require("../models/InventoryCategoriesModel");

// Each master section maps the frontend's field names onto the real columns of
// the backing table. Sections with no backing table get one created here, so a
// new section can be added to the frontend config without a migration file.
const SECTIONS = [
  { key: "units", label: "Units", table: "inventory_units" },
  { key: "vendors", label: "Vendors", table: "inventory_vendors" },
  { key: "locations", label: "Locations", table: "inventory_locations" },
  { key: "categories", label: "Categories", table: "inventory_categories" },
  { key: "menu-categories", label: "Menu Categories", table: "inventory_menu_categories" },
  { key: "stock-categories", label: "Stock Categories", table: "inventory_stock_categories" },
  {
    key: "segments",
    label: "Segments",
    table: "inventory_segments",
    create: `CREATE TABLE IF NOT EXISTS inventory_segments (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  },
  {
    key: "item-groups",
    label: "Item Groups",
    table: "inventory_item_groups",
    create: `CREATE TABLE IF NOT EXISTS inventory_item_groups (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      segment VARCHAR(150) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  },
  {
    key: "ingredients",
    label: "Ingredients",
    table: "inventory_ingredients",
    create: `CREATE TABLE IF NOT EXISTS inventory_ingredients (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      group_name VARCHAR(150) NULL,
      unit VARCHAR(60) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  },
  {
    key: "purchase-items",
    label: "Purchase Items",
    table: "inventory_purchase_orders",
    // PO items already exist in inventory_purchase_orders; expose them read-only
    // here so the masters module can list what has been procured.
    readOnly: true,
  },
  {
    key: "purchase-services",
    label: "Purchase Services",
    table: "inventory_purchase_services",
    create: `CREATE TABLE IF NOT EXISTS inventory_purchase_services (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      service_name VARCHAR(191) NOT NULL,
      vendor VARCHAR(191) NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      service_date DATE NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  },
];

// field -> { col, read (default = field), kind, default, required, numeric }
const FIELDS = {
  "menu-categories": { name: { col: "name", required: true }, parent: { col: "description", read: "parent" }, status: { col: "is_active", bool: { Active: 1, Inactive: 0 } } },
  segments: { name: { col: "name", required: true }, description: { col: "description" }, status: { col: "is_active", bool: { Active: 1, Inactive: 0 } } },
  vendors: { name: { col: "name", required: true }, contact: { col: "contact_person" }, phone: { col: "phone" }, email: { col: "email" }, city: { col: "address", read: "address" }, gstin: { col: "gstin" }, status: { col: "is_active", bool: { Active: 1, "On Hold": 1, Blacklisted: 0 } } },
  units: { name: { col: "name", required: true }, shortName: { col: "abbreviation" }, type: { col: "type" } },
  locations: { name: { col: "name", required: true }, type: { col: "type" }, manager: { col: "manager" }, status: { col: "is_active", bool: { Open: 1, Closed: 0 } } },
  "item-groups": { name: { col: "name", required: true }, segment: { col: "group_name", read: "segment" }, status: { col: "is_active", bool: { Active: 1, Inactive: 0 } } },
  ingredients: { name: { col: "name", required: true }, group: { col: "group_name", read: "group" }, unit: { col: "unit" }, status: { col: "is_active", bool: { Active: 1, Inactive: 0 } } },
  "stock-categories": { name: { col: "name", required: true }, description: { col: "description" }, status: { col: "is_active", bool: { Active: 1, Inactive: 0 } } },
  categories: { name: { col: "name", required: true }, description: { col: "description" }, status: { col: "is_active", bool: { Active: 1, Inactive: 0 } } },
  "purchase-items": { itemName: { read: "item_name" }, vendor: { read: "vendor" }, quantity: { read: "quantity" }, unit: { read: "unit" }, ratePerUnit: { read: "rate" }, amount: { read: "total" }, invoiceNo: { read: "po_number" }, date: { read: "expected_date" } },
  "purchase-services": { serviceName: { col: "service_name", read: "serviceName", required: true }, vendor: { col: "vendor" }, amount: { col: "amount", numeric: true }, date: { col: "service_date", read: "date" }, status: { col: "status" } },
};

// Columns the backend owns, not the caller. Kept out of write sets entirely.
const DEFAULTS = { "purchase-services": { status: "Pending" }, "purchase-items": {} };

const getSection = (sectionKey) => SECTIONS.find((s) => s.key === sectionKey);
const fieldDefs = (sectionKey) => FIELDS[sectionKey] || {};

// A bool column stores 1/0; report the first label whose value matches so the
// form can round-trip instead of rendering a blank select.
function boolLabel(opts, value) {
  for (const [label, num] of Object.entries(opts)) {
    if (Number(num) === Number(value)) return label;
  }
  return value;
}

function project(row, sectionKey) {
  if (!row) return row;
  const out = {};
  if (!Object.keys(fieldDefs(sectionKey)).length) {
    // No field map for this section: pass the row through, but still expose an
    // is_active flag as a friendly status so the UI is not blank.
    for (const [k, v] of Object.entries(row)) out[k] = v;
    if (typeof row.is_active === "number") out.status = row.is_active ? "Active" : "Inactive";
    return out;
  }
  for (const [field, def] of Object.entries(fieldDefs(sectionKey))) {
    const col = def.col || def.read || field;
    let v = row[col];
    if (v === undefined && def.read && def.read !== col) v = row[def.read];
    if (def.bool) v = boolLabel(def.bool, v);
    out[field] = v === undefined ? null : v;
  }
  // The UI keys rows off id and lists extra columns, so anything the map does
  // not already publish comes through unchanged.
  for (const [k, v] of Object.entries(row)) {
    if (!(k in out)) out[k] = v;
  }
  return out;
}

function buildWriteSet(sectionKey, rawBody) {
  // express.json() hands back undefined for an empty body; treat that as {}.
  const body = rawBody && typeof rawBody === "object" ? rawBody : {};
  const set = [];
  const vals = [];
  let missing = null;

  for (const [field, def] of Object.entries(fieldDefs(sectionKey))) {
    if (!def.col) continue;
    const raw = body[field];

    if (def.required && (raw === undefined || raw === null || String(raw).trim() === "")) {
      missing = def.required && field === "name" ? "name" : field;
      continue;
    }
    if (raw === undefined || raw === null || raw === "") continue;

    if (def.bool) {
      const num = def.bool[String(raw)];
      set.push(`\`${def.col}\` = ?`);
      vals.push(num === undefined ? 1 : num);
    } else if (def.numeric) {
      set.push(`\`${def.col}\` = ?`);
      vals.push(Number(raw) || 0);
    } else {
      set.push(`\`${def.col}\` = ?`);
      vals.push(raw);
    }
  }

  for (const [col, value] of Object.entries(DEFAULTS[sectionKey] || {})) {
    if (set.some((s) => s.startsWith(`\`${col}\``))) continue;
    set.push(`\`${col}\` = ?`);
    vals.push(value);
  }

  return { set, vals, missing };
}

// Add missing columns to an existing master table so a config change does not
// need a migration file. CREATE TABLE ... ADD COLUMN is not supported, so the
// columns are altered in after the table is guaranteed to exist.
async function ensureColumns(sectionKey, table) {
  const needed = [];
  for (const def of Object.values(fieldDefs(sectionKey))) {
    if (def.col && !needed.includes(def.col)) needed.push(def.col);
  }
  for (const col of Object.keys(DEFAULTS[sectionKey] || {})) {
    if (!needed.includes(col)) needed.push(col);
  }

  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\``);
  const have = new Set(rows.map((r) => r.Field));
  for (const col of needed) {
    if (have.has(col)) continue;
    try {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` VARCHAR(191) NULL`);
    } catch (err) {
      console.error(`inventory masters: could not add ${table}.${col}:`, err.message);
    }
  }
}

exports.ensureSchema = async () => {
  await ensureInventoryCategoriesSchema();
  for (const s of SECTIONS) {
    if (!s.create) continue;
    try {
      await db.query(s.create);
    } catch (err) {
      console.error(`inventory masters schema init failed for ${s.table}:`, err.message);
    }
  }
};

exports.listSections = async (req, res) => {
  try {
    await exports.ensureSchema();
    const sections = await Promise.all(
      SECTIONS.map(async (s) => {
        const [count] = await db.query(`SELECT COUNT(*) AS cnt FROM \`${s.table}\``);
        return { ...s, count: count[0]?.cnt || 0 };
      })
    );
    res.json(sections);
  } catch (err) {
    res.status(500).json({ message: "Failed to list sections", error: err.message });
  }
};

exports.listRecords = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  try {
    await exports.ensureSchema();
    const [rows] = await db.query(
      `SELECT * FROM \`${section.table}\` ORDER BY \`id\` DESC LIMIT 500`
    );
    res.json(rows.map((r) => project(r, section.key)));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch records", error: err.message });
  }
};

exports.getRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  try {
    await exports.ensureSchema();
    const [rows] = await db.query(`SELECT * FROM \`${section.table}\` WHERE \`id\` = ? LIMIT 1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Record not found." });
    res.json(project(rows[0], section.key));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch record", error: err.message });
  }
};

exports.createRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });
  if (section.readOnly) {
    return res.status(400).json({ message: "This section is read-only. Use Purchase Orders instead." });
  }

  const { set, vals, missing } = buildWriteSet(section.key, req.body);

  if (missing) return res.status(400).json({ message: `${missing} is required.` });
  if (!set.length) return res.status(400).json({ message: "Nothing to save." });

  try {
    await exports.ensureSchema();
    await ensureColumns(section.key, section.table);
    const cols = set.map((s) => s.split(" = ")[0]).join(", ");
    const [result] = await db.query(
      `INSERT INTO \`${section.table}\` (${cols}) VALUES (${set.map(() => "?").join(", ")})`,
      vals
    );
    // insertId may be undefined on zero-row inserts.
    const id = Number(result?.insertId) || 0;
    const [rows] = id
      ? await db.query(`SELECT * FROM \`${section.table}\` WHERE \`id\` = ? LIMIT 1`, [id])
      : await db.query(`SELECT * FROM \`${section.table}\` ORDER BY \`id\` DESC LIMIT 1`);
    const created = rows[0] || null;
    res.status(created ? 201 : 200).json({
      message: "Record created.",
      record: created ? project(created, section.key) : null,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create record", error: err.message });
  }
};

exports.updateRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });
  if (section.readOnly) {
    return res.status(400).json({ message: "This section is read-only. Use Purchase Orders instead." });
  }

  const { set, vals } = buildWriteSet(section.key, req.body || {});
  if (!set.length) return res.status(400).json({ message: "Nothing to update." });
  vals.push(req.params.id);

  try {
    await exports.ensureSchema();
    await ensureColumns(section.key, section.table);
    await db.query(`UPDATE \`${section.table}\` SET ${set.join(", ")} WHERE \`id\` = ?`, vals);
    const [rows] = await db.query(`SELECT * FROM \`${section.table}\` WHERE \`id\` = ? LIMIT 1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Record not found." });
    res.json({ message: "Record updated.", record: project(rows[0], section.key) });
  } catch (err) {
    res.status(500).json({ message: "Failed to update record", error: err.message });
  }
};

exports.deleteRecord = async (req, res) => {
  const section = getSection(req.params.sectionKey);
  if (!section) return res.status(404).json({ message: "Section not found" });

  try {
    await exports.ensureSchema();
    await db.query(`DELETE FROM \`${section.table}\` WHERE \`id\` = ?`, [req.params.id]);
    res.json({ message: "Record deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete record", error: err.message });
  }
};
