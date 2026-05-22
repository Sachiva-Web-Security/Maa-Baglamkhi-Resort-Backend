const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DEFAULTS = [
  "WATER/TEA/COFFEE/MILK",
  "LASSI/BUTTER MILK",
  "JUICE/SODA",
  "MOCKTAIL",
  "SHAKE",
  "COLD DRINKS",
  "SANDWICH",
  "CHAAT BOWL",
  "PIZZA",
  "PAKODA",
  "SIDE",
  "VEG. STARTER",
  "PANEER STARTER",
  "CHINESE STARTER",
  "SIZZLER",
  "SOUTH INDIANS",
  "EXTRA",
  "SOUP",
  "PAPAD/SALAD/RAITA",
];

const columnExists = async (column) => {
  const rows = await runQuery("SHOW COLUMNS FROM fb_item_groups LIKE ?", [column]);
  return Array.isArray(rows) && rows.length > 0;
};

const addColumnIfMissing = async (column, definition) => {
  if (!(await columnExists(column))) {
    await runQuery(`ALTER TABLE fb_item_groups ADD COLUMN ${column} ${definition}`);
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_item_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      invoice_group_id INT DEFAULT NULL,
      print_group_id INT DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_group_id) REFERENCES fb_invoice_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (print_group_id) REFERENCES fb_print_groups(id) ON DELETE SET NULL
    )
  `);

  await addColumnIfMissing("group_type", "VARCHAR(20) NOT NULL DEFAULT 'main'");
  await addColumnIfMissing("parent_id", "INT DEFAULT NULL");
  await addColumnIfMissing("category", "VARCHAR(100) DEFAULT NULL");
  await addColumnIfMissing("print_group_2_id", "INT DEFAULT NULL");

  // Many-to-many: item group ↔ price groups
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_item_group_price_groups (
      item_group_id INT NOT NULL,
      price_group_id INT NOT NULL,
      PRIMARY KEY (item_group_id, price_group_id),
      FOREIGN KEY (item_group_id) REFERENCES fb_item_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (price_group_id) REFERENCES fb_price_groups(id) ON DELETE CASCADE
    )
  `);

  // Seed if empty
  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_item_groups");
  if (Number(rows?.[0]?.count || 0) === 0) {
    const invRows = await runQuery("SELECT id, name FROM fb_invoice_groups WHERE name = 'Food' LIMIT 1");
    const prtRows = await runQuery("SELECT id, name FROM fb_print_groups WHERE name = 'Kitchen KOT' LIMIT 1");
    const invId = invRows[0]?.id || null;
    const prtId = prtRows[0]?.id || null;
    for (const name of DEFAULTS) {
      await runQuery(
        `INSERT INTO fb_item_groups (name, invoice_group_id, print_group_id, group_type, category)
         VALUES (?, ?, ?, 'main', 'BEVERAGES')`,
        [name, invId, prtId],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  group_type: r.group_type || "main",
  parent_id: r.parent_id,
  invoice_group_id: r.invoice_group_id,
  invoice_group_name: r.invoice_group_name || "",
  print_group_id: r.print_group_id,
  print_group_name: r.print_group_name || "",
  print_group_2_id: r.print_group_2_id,
  print_group_2_name: r.print_group_2_name || "",
  category: r.category || "",
  is_active: Number(r.is_active) === 1,
  price_group_ids: [],
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Item group name is required");
  const group_type = body?.group_type === "sub" ? "sub" : "main";
  return {
    name,
    group_type,
    parent_id:
      group_type === "sub" && body?.parent_id ? Number(body.parent_id) : null,
    invoice_group_id: body?.invoice_group_id ? Number(body.invoice_group_id) : null,
    print_group_id: body?.print_group_id ? Number(body.print_group_id) : null,
    print_group_2_id: body?.print_group_2_id ? Number(body.print_group_2_id) : null,
    category: String(body?.category || "").trim() || null,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const loadPriceGroupIdsFor = async (itemGroupId) => {
  const rows = await runQuery(
    "SELECT price_group_id FROM fb_item_group_price_groups WHERE item_group_id = ?",
    [itemGroupId],
  );
  return rows.map((r) => r.price_group_id);
};

const setPriceGroupsFor = async (itemGroupId, priceGroupIds) => {
  await runQuery(
    "DELETE FROM fb_item_group_price_groups WHERE item_group_id = ?",
    [itemGroupId],
  );
  if (!Array.isArray(priceGroupIds) || priceGroupIds.length === 0) return;
  for (const pgId of priceGroupIds) {
    const n = Number(pgId);
    if (!Number.isFinite(n)) continue;
    await runQuery(
      "INSERT IGNORE INTO fb_item_group_price_groups (item_group_id, price_group_id) VALUES (?, ?)",
      [itemGroupId, n],
    );
  }
};

const list = async ({ name = "" } = {}) => {
  const where = [];
  const params = [];
  if (name) {
    where.push("ig.name LIKE ?");
    params.push(`%${name}%`);
  }
  const rows = await runQuery(
    `SELECT ig.*,
            inv.name AS invoice_group_name,
            prt.name AS print_group_name,
            prt2.name AS print_group_2_name
       FROM fb_item_groups ig
       LEFT JOIN fb_invoice_groups inv ON inv.id = ig.invoice_group_id
       LEFT JOIN fb_print_groups prt ON prt.id = ig.print_group_id
       LEFT JOIN fb_print_groups prt2 ON prt2.id = ig.print_group_2_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY ig.id ASC`,
    params,
  );
  const mapped = rows.map(mapRow);
  for (const row of mapped) {
    row.price_group_ids = await loadPriceGroupIdsFor(row.id);
  }
  return mapped;
};

const getById = async (id) => {
  const rows = await runQuery(
    `SELECT ig.*,
            inv.name AS invoice_group_name,
            prt.name AS print_group_name,
            prt2.name AS print_group_2_name
       FROM fb_item_groups ig
       LEFT JOIN fb_invoice_groups inv ON inv.id = ig.invoice_group_id
       LEFT JOIN fb_print_groups prt ON prt.id = ig.print_group_id
       LEFT JOIN fb_print_groups prt2 ON prt2.id = ig.print_group_2_id
      WHERE ig.id = ?`,
    [id],
  );
  if (!rows[0]) return null;
  const row = mapRow(rows[0]);
  row.price_group_ids = await loadPriceGroupIdsFor(row.id);
  return row;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO fb_item_groups
       (name, group_type, parent_id, invoice_group_id, print_group_id,
        print_group_2_id, category, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.group_type, p.parent_id, p.invoice_group_id, p.print_group_id,
     p.print_group_2_id, p.category, p.is_active],
  );
  if (Array.isArray(body?.price_group_ids)) {
    await setPriceGroupsFor(result.insertId, body.price_group_ids);
  }
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE fb_item_groups
        SET name = ?, group_type = ?, parent_id = ?,
            invoice_group_id = ?, print_group_id = ?, print_group_2_id = ?,
            category = ?, is_active = ?
      WHERE id = ?`,
    [p.name, p.group_type, p.parent_id,
     p.invoice_group_id, p.print_group_id, p.print_group_2_id,
     p.category, p.is_active, id],
  );
  if (Array.isArray(body?.price_group_ids)) {
    await setPriceGroupsFor(id, body.price_group_ids);
  }
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_item_groups WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove, getById };
