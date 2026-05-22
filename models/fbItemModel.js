const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const columnExists = async (column) => {
  const rows = await runQuery("SHOW COLUMNS FROM fb_items LIKE ?", [column]);
  return Array.isArray(rows) && rows.length > 0;
};

const addColumnIfMissing = async (column, definition) => {
  if (!(await columnExists(column))) {
    await runQuery(`ALTER TABLE fb_items ADD COLUMN ${column} ${definition}`);
  }
};

const SEEDS = [
  { group: "WATER/TEA/COFFEE/MILK", code: "1",  name: "Mineral Water 1 Ltr.",       rate: 19.10 },
  { group: "WATER/TEA/COFFEE/MILK", code: "2",  name: "Mineral Water 500 Ml",       rate: 10.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "3",  name: "Alkaline Water 1 Ltr.",      rate: 28.57 },
  { group: "WATER/TEA/COFFEE/MILK", code: "4",  name: "Hot Tea",                    rate: 35.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "5",  name: "Masala Hot Tea",             rate: 45.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "6",  name: "Black Tea",                  rate: 40.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "7",  name: "Hot Coffee",                 rate: 50.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "8",  name: "Cold Coffee",                rate: 110.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "9",  name: "Cold Coffee With Ice Cream", rate: 125.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "10", name: "Pure Hot Milk",              rate: 55.00 },
  { group: "WATER/TEA/COFFEE/MILK", code: "11", name: "Pure Cold Milk",             rate: 45.00 },
  { group: "LASSI/BUTTER MILK",    code: "12", name: "Sweet Lassi",                rate: 90.00 },
  { group: "LASSI/BUTTER MILK",    code: "13", name: "Salted Lassi",               rate: 80.00 },
  { group: "LASSI/BUTTER MILK",    code: "14", name: "Kesar Lassi",                rate: 120.00 },
];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_group_id INT DEFAULT NULL,
      item_code VARCHAR(64) DEFAULT NULL,
      bar_code VARCHAR(64) DEFAULT NULL,
      name VARCHAR(191) NOT NULL,
      display_name VARCHAR(191) DEFAULT NULL,
      current_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit_id INT DEFAULT NULL,
      is_favourite TINYINT(1) NOT NULL DEFAULT 0,
      apply_discount TINYINT(1) NOT NULL DEFAULT 0,
      is_stock TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (item_group_id) REFERENCES fb_item_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (unit_id) REFERENCES fb_units(id) ON DELETE SET NULL
    )
  `);

  await addColumnIfMissing("display_name", "VARCHAR(191) DEFAULT NULL");
  await addColumnIfMissing("bar_code", "VARCHAR(64) DEFAULT NULL");
  await addColumnIfMissing("is_favourite", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("apply_discount", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("is_stock", "TINYINT(1) NOT NULL DEFAULT 0");

  // Extended item-basic fields (from edit form)
  await addColumnIfMissing("parent_item_id", "INT DEFAULT NULL");
  await addColumnIfMissing("shortcut_key", "VARCHAR(32) DEFAULT NULL");
  await addColumnIfMissing("description", "TEXT");
  await addColumnIfMissing("default_quantity", "DECIMAL(10,4) NOT NULL DEFAULT 1");
  await addColumnIfMissing("gst_item_type", "VARCHAR(64) DEFAULT NULL");
  await addColumnIfMissing("gst_hsn_code", "VARCHAR(32) DEFAULT NULL");
  await addColumnIfMissing("qty_decimal", "INT NOT NULL DEFAULT 3");
  await addColumnIfMissing("spicy", "VARCHAR(8) DEFAULT 'NA'");
  await addColumnIfMissing("calories", "VARCHAR(32) DEFAULT 'NA'");
  await addColumnIfMissing("hot_or_cold", "VARCHAR(8) DEFAULT 'NA'");
  await addColumnIfMissing("prepare_time", "VARCHAR(32) DEFAULT 'NA'");
  await addColumnIfMissing("is_non_veg", "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfMissing("image_path", "VARCHAR(255) DEFAULT NULL");

  // Rate history table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_item_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NOT NULL,
      effective_date DATE NOT NULL,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES fb_items(id) ON DELETE CASCADE
    )
  `);

  // Per-item discount config
  await runQuery(`
    CREATE TABLE IF NOT EXISTS fb_item_discounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_id INT NOT NULL,
      discount_type VARCHAR(8) NOT NULL DEFAULT 'pct',
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      date_from DATE DEFAULT NULL,
      date_to DATE DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES fb_items(id) ON DELETE CASCADE
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM fb_items");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const s of SEEDS) {
      const g = await runQuery(
        "SELECT id FROM fb_item_groups WHERE name = ? LIMIT 1",
        [s.group],
      );
      const groupId = g?.[0]?.id || null;
      const result = await runQuery(
        `INSERT INTO fb_items
           (item_group_id, item_code, name, display_name, current_rate, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [groupId, s.code, s.name, s.name, s.rate],
      );
      // Seed a single rate history row for the seeded item
      await runQuery(
        `INSERT INTO fb_item_rates (item_id, effective_date, rate)
         VALUES (?, CURRENT_DATE, ?)`,
        [result.insertId, s.rate],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  item_group_id: r.item_group_id,
  item_group_name: r.item_group_name || "",
  item_code: r.item_code || "",
  bar_code: r.bar_code || "",
  name: r.name || "",
  display_name: r.display_name || "",
  current_rate: Number(r.current_rate || 0),
  unit_id: r.unit_id,
  unit_name: r.unit_name || "",
  is_favourite: Number(r.is_favourite) === 1,
  apply_discount: Number(r.apply_discount) === 1,
  is_stock: Number(r.is_stock) === 1,
  is_active: Number(r.is_active) === 1,
  parent_item_id: r.parent_item_id,
  shortcut_key: r.shortcut_key || "",
  description: r.description || "",
  default_quantity: Number(r.default_quantity || 1),
  gst_item_type: r.gst_item_type || "",
  gst_hsn_code: r.gst_hsn_code || "",
  qty_decimal: Number(r.qty_decimal || 3),
  spicy: r.spicy || "NA",
  calories: r.calories || "NA",
  hot_or_cold: r.hot_or_cold || "NA",
  prepare_time: r.prepare_time || "NA",
  is_non_veg: Number(r.is_non_veg) === 1,
  image_path: r.image_path || "",
});

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Item name is required");
  return {
    item_group_id: body?.item_group_id ? Number(body.item_group_id) : null,
    item_code: String(body?.item_code || "").trim() || null,
    bar_code: String(body?.bar_code || "").trim() || null,
    name,
    display_name: String(body?.display_name || "").trim() || name,
    current_rate: Number(body?.current_rate) || 0,
    unit_id: body?.unit_id ? Number(body.unit_id) : null,
    is_favourite: body?.is_favourite ? 1 : 0,
    apply_discount: body?.apply_discount ? 1 : 0,
    is_stock: body?.is_stock ? 1 : 0,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
    parent_item_id: body?.parent_item_id ? Number(body.parent_item_id) : null,
    shortcut_key: String(body?.shortcut_key || "").trim() || null,
    description: String(body?.description || ""),
    default_quantity: Number(body?.default_quantity) || 1,
    gst_item_type: String(body?.gst_item_type || "").trim() || null,
    gst_hsn_code: String(body?.gst_hsn_code || "").trim() || null,
    qty_decimal: Number.isFinite(Number(body?.qty_decimal)) ? Number(body.qty_decimal) : 3,
    spicy: ["NA", "Yes", "No"].includes(body?.spicy) ? body.spicy : "NA",
    calories: String(body?.calories || "NA"),
    hot_or_cold: ["NA", "Hot", "Cold"].includes(body?.hot_or_cold) ? body.hot_or_cold : "NA",
    prepare_time: String(body?.prepare_time || "NA"),
    is_non_veg: body?.is_non_veg ? 1 : 0,
    image_path: String(body?.image_path || "").trim() || null,
  };
};

const baseSelect = `
  SELECT i.*,
         g.name AS item_group_name,
         u.name AS unit_name
    FROM fb_items i
    LEFT JOIN fb_item_groups g ON g.id = i.item_group_id
    LEFT JOIN fb_units u ON u.id = i.unit_id
`;

const list = async ({ item_group_id = "", item_code = "", name = "" } = {}) => {
  const where = [];
  const params = [];
  if (item_group_id) {
    where.push("i.item_group_id = ?");
    params.push(Number(item_group_id));
  }
  if (item_code) {
    where.push("i.item_code LIKE ?");
    params.push(`%${item_code}%`);
  }
  if (name) {
    where.push("i.name LIKE ?");
    params.push(`%${name}%`);
  }
  const rows = await runQuery(
    `${baseSelect} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY i.id ASC`,
    params,
  );
  return rows.map(mapRow);
};

const getById = async (id) => {
  const rows = await runQuery(`${baseSelect} WHERE i.id = ?`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO fb_items
       (item_group_id, item_code, bar_code, name, display_name, current_rate, unit_id,
        is_favourite, apply_discount, is_stock, is_active,
        parent_item_id, shortcut_key, description, default_quantity,
        gst_item_type, gst_hsn_code, qty_decimal,
        spicy, calories, hot_or_cold, prepare_time, is_non_veg, image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?,  ?, ?, ?, ?,  ?, ?, ?,  ?, ?, ?, ?, ?, ?)`,
    [
      p.item_group_id, p.item_code, p.bar_code, p.name, p.display_name, p.current_rate, p.unit_id,
      p.is_favourite, p.apply_discount, p.is_stock, p.is_active,
      p.parent_item_id, p.shortcut_key, p.description, p.default_quantity,
      p.gst_item_type, p.gst_hsn_code, p.qty_decimal,
      p.spicy, p.calories, p.hot_or_cold, p.prepare_time, p.is_non_veg, p.image_path,
    ],
  );
  // Seed a starting rate history row for the new item
  await runQuery(
    `INSERT INTO fb_item_rates (item_id, effective_date, rate)
     VALUES (?, CURRENT_DATE, ?)`,
    [result.insertId, p.current_rate],
  );
  return getById(result.insertId);
};

const update = async (id, body) => {
  const p = sanitize(body);
  // Detect rate change to append history
  const prev = await runQuery("SELECT current_rate FROM fb_items WHERE id = ?", [id]);
  const prevRate = Number(prev?.[0]?.current_rate || 0);
  await runQuery(
    `UPDATE fb_items SET
        item_group_id = ?, item_code = ?, bar_code = ?, name = ?, display_name = ?,
        current_rate = ?, unit_id = ?, is_favourite = ?, apply_discount = ?,
        is_stock = ?, is_active = ?,
        parent_item_id = ?, shortcut_key = ?, description = ?, default_quantity = ?,
        gst_item_type = ?, gst_hsn_code = ?, qty_decimal = ?,
        spicy = ?, calories = ?, hot_or_cold = ?, prepare_time = ?, is_non_veg = ?, image_path = ?
      WHERE id = ?`,
    [
      p.item_group_id, p.item_code, p.bar_code, p.name, p.display_name,
      p.current_rate, p.unit_id, p.is_favourite, p.apply_discount,
      p.is_stock, p.is_active,
      p.parent_item_id, p.shortcut_key, p.description, p.default_quantity,
      p.gst_item_type, p.gst_hsn_code, p.qty_decimal,
      p.spicy, p.calories, p.hot_or_cold, p.prepare_time, p.is_non_veg, p.image_path,
      id,
    ],
  );
  if (Number(prevRate.toFixed(2)) !== Number(p.current_rate.toFixed(2))) {
    await runQuery(
      `INSERT INTO fb_item_rates (item_id, effective_date, rate)
       VALUES (?, CURRENT_DATE, ?)`,
      [id, p.current_rate],
    );
  }
  return getById(id);
};

const remove = async (id) => {
  await runQuery("DELETE FROM fb_items WHERE id = ?", [id]);
};

// ---- Item Rates history ----

const listRates = async (itemId) => {
  const rows = await runQuery(
    "SELECT id, item_id, effective_date, rate FROM fb_item_rates WHERE item_id = ? ORDER BY effective_date DESC, id DESC",
    [itemId],
  );
  return rows.map((r) => ({
    id: r.id,
    item_id: r.item_id,
    effective_date: r.effective_date,
    rate: Number(r.rate || 0),
  }));
};

const addRate = async (itemId, body) => {
  const effectiveDate = body?.effective_date || null;
  const rate = Number(body?.rate);
  if (!effectiveDate) throw new Error("Effective date is required");
  if (!Number.isFinite(rate)) throw new Error("Rate must be a number");
  await runQuery(
    "INSERT INTO fb_item_rates (item_id, effective_date, rate) VALUES (?, ?, ?)",
    [itemId, effectiveDate, rate],
  );
  // Update current_rate on the parent item to reflect the latest rate
  await runQuery("UPDATE fb_items SET current_rate = ? WHERE id = ?", [rate, itemId]);
  return listRates(itemId);
};

const removeRate = async (itemId, rateId) => {
  await runQuery("DELETE FROM fb_item_rates WHERE id = ? AND item_id = ?", [rateId, itemId]);
  return listRates(itemId);
};

// ---- Item Discount ----

const getDiscount = async (itemId) => {
  const rows = await runQuery(
    "SELECT * FROM fb_item_discounts WHERE item_id = ? ORDER BY id DESC LIMIT 1",
    [itemId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    item_id: r.item_id,
    discount_type: r.discount_type || "pct",
    discount_value: Number(r.discount_value || 0),
    date_from: r.date_from,
    date_to: r.date_to,
  };
};

const saveDiscount = async (itemId, body) => {
  const discount_type = body?.discount_type === "amt" ? "amt" : "pct";
  const discount_value = Number(body?.discount_value) || 0;
  const date_from = body?.date_from || null;
  const date_to = body?.date_to || null;
  if (!date_from || !date_to) throw new Error("Date range is required");
  const existing = await getDiscount(itemId);
  if (existing) {
    await runQuery(
      `UPDATE fb_item_discounts
          SET discount_type = ?, discount_value = ?, date_from = ?, date_to = ?
        WHERE id = ?`,
      [discount_type, discount_value, date_from, date_to, existing.id],
    );
  } else {
    await runQuery(
      `INSERT INTO fb_item_discounts (item_id, discount_type, discount_value, date_from, date_to)
       VALUES (?, ?, ?, ?, ?)`,
      [itemId, discount_type, discount_value, date_from, date_to],
    );
  }
  return getDiscount(itemId);
};

module.exports = {
  ensureSchema,
  list,
  create,
  update,
  remove,
  getById,
  listRates,
  addRate,
  removeRate,
  getDiscount,
  saveDiscount,
};
