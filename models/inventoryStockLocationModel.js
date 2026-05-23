const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const SEEDS = ["Main Store", "Kitchen", "Bar", "Counter"];

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS inventory_stock_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL UNIQUE,
      description VARCHAR(255) DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT COUNT(*) AS count FROM inventory_stock_locations");
  if (Number(rows?.[0]?.count || 0) === 0) {
    for (const name of SEEDS) {
      await runQuery(
        "INSERT INTO inventory_stock_locations (name) VALUES (?)",
        [name],
      );
    }
  }
};

const mapRow = (r) => ({
  id: r.id,
  name: r.name || "",
  description: r.description || "",
  is_active: Number(r.is_active) === 1,
});

const list = async () => {
  const rows = await runQuery(
    "SELECT * FROM inventory_stock_locations ORDER BY id ASC",
  );
  return rows.map(mapRow);
};

module.exports = { ensureSchema, list };
