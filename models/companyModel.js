// models/companyModel.js

const db = require("../config/db");

const addCompany = (data, callback) => {
  // 🔒 safety check
  if (!data.companyName) {
    return callback(new Error("Company name is required"));
  }

  const sql = `
    INSERT INTO companies
    (booking_id, company_name, gstin)
    VALUES (?,?,?)
  `;

  db.query(
    sql,
    [
      data.booking_id,
      data.companyName, // ✅ matches frontend
      data.gst || null  // ✅ optional GST
    ],
    (err, result) => {
      if (err) {
        console.error("❌ DB ERROR (Company):", err);
        return callback(err);
      }
      callback(null, result);
    }
  );
};

module.exports = {
  addCompany
};