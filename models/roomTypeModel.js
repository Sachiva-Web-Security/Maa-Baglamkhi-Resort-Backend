const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const RATE_TYPES = ["Single Bed", "Double Bed", "Triple Bed", "Extra Bed", "Child Rate"];
const SEASONS = ["basic", "rack", "seasonal", "peak_season", "ep"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_type_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_type_id INT NOT NULL,
      rate_type VARCHAR(50) NOT NULL,
      basic DECIMAL(12,2) NOT NULL DEFAULT 0,
      rack DECIMAL(12,2) NOT NULL DEFAULT 0,
      seasonal DECIMAL(12,2) NOT NULL DEFAULT 0,
      peak_season DECIMAL(12,2) NOT NULL DEFAULT 0,
      ep DECIMAL(12,2) NOT NULL DEFAULT 0,
      UNIQUE KEY uniq_type_rate (room_type_id, rate_type),
      FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
    )
  `);
};

const ensureRateRows = async (roomTypeId) => {
  for (const rt of RATE_TYPES) {
    await runQuery(
      `INSERT IGNORE INTO room_type_rates (room_type_id, rate_type) VALUES (?, ?)`,
      [roomTypeId, rt],
    );
  }
};

const sanitizeRates = (rates) => {
  // rates can be: array of {rate_type, basic, rack, seasonal, peak_season, ep}
  // or object keyed by rate_type
  const out = [];
  for (const rt of RATE_TYPES) {
    let row =
      Array.isArray(rates)
        ? rates.find((r) => r?.rate_type === rt) || {}
        : rates?.[rt] || {};
    const obj = { rate_type: rt };
    for (const s of SEASONS) {
      const v = Number(row?.[s] ?? 0);
      obj[s] = Number.isFinite(v) ? v : 0;
    }
    out.push(obj);
  }
  return out;
};

const persistRates = async (roomTypeId, rates) => {
  const normalized = sanitizeRates(rates);
  for (const r of normalized) {
    await runQuery(
      `INSERT INTO room_type_rates
         (room_type_id, rate_type, basic, rack, seasonal, peak_season, ep)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         basic = VALUES(basic),
         rack = VALUES(rack),
         seasonal = VALUES(seasonal),
         peak_season = VALUES(peak_season),
         ep = VALUES(ep)`,
      [roomTypeId, r.rate_type, r.basic, r.rack, r.seasonal, r.peak_season, r.ep],
    );
  }
};

const loadRatesFor = async (roomTypeId) => {
  const rows = await runQuery(
    `SELECT rate_type, basic, rack, seasonal, peak_season, ep
       FROM room_type_rates
      WHERE room_type_id = ?`,
    [roomTypeId],
  );
  const byType = new Map(rows.map((r) => [r.rate_type, r]));
  return RATE_TYPES.map((rt) => {
    const r = byType.get(rt) || {};
    return {
      rate_type: rt,
      basic: Number(r.basic) || 0,
      rack: Number(r.rack) || 0,
      seasonal: Number(r.seasonal) || 0,
      peak_season: Number(r.peak_season) || 0,
      ep: Number(r.ep) || 0,
    };
  });
};

const list = async () => {
  const types = await runQuery(
    "SELECT id, name, is_active FROM room_types ORDER BY id ASC",
  );
  const result = [];
  for (const t of types) {
    const rates = await loadRatesFor(t.id);
    result.push({
      id: t.id,
      name: t.name || "",
      is_active: Number(t.is_active) === 1,
      rates,
    });
  }
  return result;
};

const sanitize = (body) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Room type name is required");
  return {
    name,
    is_active: body?.is_active === false || body?.is_active === 0 ? 0 : 1,
  };
};

const create = async (body) => {
  const p = sanitize(body);
  const result = await runQuery(
    "INSERT INTO room_types (name, is_active) VALUES (?, ?)",
    [p.name, p.is_active],
  );
  await ensureRateRows(result.insertId);
  if (body?.rates) {
    await persistRates(result.insertId, body.rates);
  }
  const rates = await loadRatesFor(result.insertId);
  return { id: result.insertId, name: p.name, is_active: !!p.is_active, rates };
};

const update = async (id, body) => {
  const p = sanitize(body);
  await runQuery(
    "UPDATE room_types SET name = ?, is_active = ? WHERE id = ?",
    [p.name, p.is_active, id],
  );
  await ensureRateRows(id);
  if (body?.rates) {
    await persistRates(id, body.rates);
  }
  const rates = await loadRatesFor(id);
  return { id: Number(id), name: p.name, is_active: !!p.is_active, rates };
};

const remove = async (id) => {
  await runQuery("DELETE FROM room_types WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  list,
  create,
  update,
  remove,
  RATE_TYPES,
  SEASONS,
};
