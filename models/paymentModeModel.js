const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS payment_modes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      position INT NOT NULL,
      name VARCHAR(191) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_position (position)
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM payment_modes");
  if (Number(rows?.[0]?.count || 0) === 0) {
    // seed 15 slots, with slot 1 = CASH
    for (let i = 1; i <= 15; i++) {
      await runQuery(
        "INSERT INTO payment_modes (position, name) VALUES (?, ?)",
        [i, i === 1 ? "CASH" : null],
      );
    }
  }
};

const listPaymentModes = async () => {
  const rows = await runQuery(
    "SELECT id, position, name, is_active FROM payment_modes ORDER BY position ASC",
  );
  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    name: r.name || "",
    is_active: Number(r.is_active) === 1,
  }));
};

const updateSlot = async (id, name) => {
  const cleaned = String(name || "").trim();
  await runQuery(
    "UPDATE payment_modes SET name = ? WHERE id = ?",
    [cleaned || null, id],
  );
  const rows = await runQuery(
    "SELECT id, position, name, is_active FROM payment_modes WHERE id = ?",
    [id],
  );
  const row = rows[0] || null;
  if (!row) return null;
  return {
    id: row.id,
    position: row.position,
    name: row.name || "",
    is_active: Number(row.is_active) === 1,
  };
};

const addSlot = async (name) => {
  const cleaned = String(name || "").trim();
  const rows = await runQuery(
    "SELECT COALESCE(MAX(position), 0) AS maxPos FROM payment_modes",
  );
  const nextPos = Number(rows?.[0]?.maxPos || 0) + 1;
  const result = await runQuery(
    "INSERT INTO payment_modes (position, name) VALUES (?, ?)",
    [nextPos, cleaned || null],
  );
  return {
    id: result.insertId,
    position: nextPos,
    name: cleaned,
    is_active: true,
  };
};

const deleteSlot = async (id) => {
  await runQuery("DELETE FROM payment_modes WHERE id = ?", [id]);
};

module.exports = {
  ensureSchema,
  listPaymentModes,
  updateSlot,
  addSlot,
  deleteSlot,
};
