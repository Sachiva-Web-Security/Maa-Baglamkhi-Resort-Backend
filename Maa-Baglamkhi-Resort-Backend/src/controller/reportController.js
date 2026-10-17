const db = require("../config/db");

const ensureSchema = async () => {
  await db.query(`
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
    // Bills accumulate duplicate payment rows (bill 1 has 36), so count one
    // row per bill and keep the rest as single rows.
    const [rows] = await db.query(
      `SELECT day AS date, SUM(amount) as total
       FROM (
         SELECT DATE(p.created_at) AS day, p.amount
         FROM (
           SELECT MAX(id) AS last_id FROM payments
           WHERE bill_id IS NOT NULL AND DATE(created_at) BETWEEN ? AND ?
           GROUP BY bill_id
           UNION ALL
           SELECT id FROM payments
           WHERE bill_id IS NULL AND DATE(created_at) BETWEEN ? AND ?
         ) dedup
         JOIN payments p ON p.id = dedup.last_id
       ) deduped
       GROUP BY day`,
      [start, end, start, end],
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
    const [rows] = await db.query(
      `SELECT name AS item_name, SUM(quantity) AS quantity
       FROM order_items
       GROUP BY name`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
};
