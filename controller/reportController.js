const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(60) NOT NULL,
      title VARCHAR(255) DEFAULT NULL,
      data JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

// DAYWISE
exports.daywise = async (req, res) => {
  const { start, end } = req.query;

  try {
    await ensureSchema();
    const rows = await runQuery(
      `SELECT DATE(created_at) as date, SUM(total) as total
       FROM payments
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)`,
      [start, end],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
};

// ITEM CONSUMPTION
exports.itemConsumption = async (req, res) => {
  try {
    await ensureSchema();
    const rows = await runQuery(
      `SELECT item_name, SUM(qty) as quantity
       FROM token_items
       GROUP BY item_name`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
};
