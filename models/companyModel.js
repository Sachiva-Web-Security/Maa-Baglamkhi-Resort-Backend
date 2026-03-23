// models/companyModel.js

const db = require("../config/db");

const addCompany = (data, callback) => {
  // 🔒 safety check
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
        console.error("❌ DB ERROR (Company lookup):", findErr);
        return callback(findErr);
      }

      if (rows.length) {
        db.query(
          "UPDATE companies SET company_name = ?, gstin = ? WHERE booking_id = ?",
          [companyName, gstin, bookingId],
          (updateErr, result) => {
            if (updateErr) {
              console.error("❌ DB ERROR (Company update):", updateErr);
              return callback(updateErr);
            }
            callback(null, result);
          },
        );
        return;
      }

      db.query(
        `
          INSERT INTO companies
          (booking_id, company_name, gstin)
          VALUES (?,?,?)
        `,
        [bookingId, companyName, gstin],
        (insertErr, result) => {
          if (insertErr) {
            console.error("❌ DB ERROR (Company insert):", insertErr);
            return callback(insertErr);
          }
          callback(null, result);
        },
      );
    },
  );
};

module.exports = {
  addCompany
};
