const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS financial_year (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fy_start_date DATE NOT NULL,
      fy_end_date DATE NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await runQuery("SELECT id FROM financial_year LIMIT 1");
  if (!rows.length) {
    await runQuery(
      "INSERT INTO financial_year (fy_start_date, fy_end_date) VALUES (?, ?)",
      ["2023-04-01", "2024-03-31"],
    );
  }
};

const formatDate = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getFinancialYear = async () => {
  const rows = await runQuery(
    "SELECT * FROM financial_year ORDER BY id ASC LIMIT 1",
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    fy_start_date: formatDate(row.fy_start_date),
    fy_end_date: formatDate(row.fy_end_date),
    updated_at: row.updated_at,
  };
};

const saveFinancialYear = async ({ fy_start_date, fy_end_date }) => {
  if (!fy_start_date || !fy_end_date) {
    throw new Error("Both FY start and end dates are required");
  }

  const existing = await getFinancialYear();
  if (existing) {
    await runQuery(
      "UPDATE financial_year SET fy_start_date = ?, fy_end_date = ? WHERE id = ?",
      [fy_start_date, fy_end_date, existing.id],
    );
  } else {
    await runQuery(
      "INSERT INTO financial_year (fy_start_date, fy_end_date) VALUES (?, ?)",
      [fy_start_date, fy_end_date],
    );
  }
  return getFinancialYear();
};

module.exports = {
  ensureSchema,
  getFinancialYear,
  saveFinancialYear,
};
