const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      company_name VARCHAR(191) NOT NULL,
      gstin VARCHAR(100) DEFAULT NULL
    )
  `);
};

const addCompany = (data, callback) => {
  if (!data.companyName) {
    return callback(new Error("Company name is required"));
  }

  const bookingId = Number(data.booking_id);
  const companyName = String(data.companyName).trim();
  const gstin = String(data.gst || "").trim() || null;

  db.query(
    "SELECT id FROM companies WHERE booking_id = ? LIMIT 1",
    [bookingId],
    (findErr, rows) => {
      if (findErr) {
        return callback(findErr);
      }

      if (rows.length) {
        db.query(
          "UPDATE companies SET company_name = ?, gstin = ? WHERE booking_id = ?",
          [companyName, gstin, bookingId],
          callback,
        );
        return;
      }

      db.query(
        "INSERT INTO companies (booking_id, company_name, gstin) VALUES (?,?,?)",
        [bookingId, companyName, gstin],
        callback,
      );
    },
  );
};

module.exports = {
  ensureSchema,
  addCompany,
};
