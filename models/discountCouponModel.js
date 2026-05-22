const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const DISCOUNT_TYPES = ["Percentage", "Fixed"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS discount_coupons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coupon_code VARCHAR(50) NOT NULL UNIQUE,
      discount_type VARCHAR(20) NOT NULL DEFAULT 'Percentage',
      discount_value DECIMAL(15,2) NOT NULL DEFAULT 0,
      valid_from DATE DEFAULT NULL,
      valid_to DATE DEFAULT NULL,
      max_usage INT DEFAULT 0,
      total_used INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const formatDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const mapRow = (r) => ({
  id: r.id,
  coupon_code: r.coupon_code || "",
  discount_type: r.discount_type || "Percentage",
  discount_value: Number(r.discount_value) || 0,
  valid_from: formatDate(r.valid_from),
  valid_to: formatDate(r.valid_to),
  max_usage: Number(r.max_usage) || 0,
  total_used: Number(r.total_used) || 0,
  is_active: Number(r.is_active) === 1,
});

const sanitize = (body) => {
  const coupon_code = String(body?.coupon_code || "").trim().toUpperCase();
  if (!coupon_code) throw new Error("Coupon code is required");
  const discount_type = DISCOUNT_TYPES.includes(body?.discount_type)
    ? body.discount_type
    : "Percentage";
  const discount_value = Number(body?.discount_value || 0);
  if (Number.isNaN(discount_value)) throw new Error("Discount value must be a number");
  if (discount_type === "Percentage" && (discount_value < 0 || discount_value > 100)) {
    throw new Error("Percentage discount must be between 0 and 100");
  }
  const max_usage = Number(body?.max_usage || 0);
  if (Number.isNaN(max_usage) || max_usage < 0) {
    throw new Error("Max usage must be a non-negative number");
  }
  const valid_from = body?.valid_from ? formatDate(body.valid_from) : null;
  const valid_to = body?.valid_to ? formatDate(body.valid_to) : null;
  if (valid_from && valid_to && new Date(valid_to) < new Date(valid_from)) {
    throw new Error("Valid To must be on or after Valid From");
  }
  return {
    coupon_code,
    discount_type,
    discount_value,
    valid_from,
    valid_to,
    max_usage,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const list = async () => {
  const rows = await runQuery(
    "SELECT * FROM discount_coupons ORDER BY id DESC",
  );
  return rows.map(mapRow);
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    `INSERT INTO discount_coupons
       (coupon_code, discount_type, discount_value, valid_from, valid_to, max_usage, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.coupon_code, p.discount_type, p.discount_value, p.valid_from, p.valid_to, p.max_usage, p.is_active],
  );
  const rows = await runQuery("SELECT * FROM discount_coupons WHERE id = ?", [result.insertId]);
  return mapRow(rows[0]);
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    `UPDATE discount_coupons
        SET coupon_code = ?, discount_type = ?, discount_value = ?,
            valid_from = ?, valid_to = ?, max_usage = ?, is_active = ?
      WHERE id = ?`,
    [p.coupon_code, p.discount_type, p.discount_value, p.valid_from, p.valid_to, p.max_usage, p.is_active, id],
  );
  const rows = await runQuery("SELECT * FROM discount_coupons WHERE id = ?", [id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const remove = async (id) => {
  await runQuery("DELETE FROM discount_coupons WHERE id = ?", [id]);
};

module.exports = { ensureSchema, list, create, update, remove };
