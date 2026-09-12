const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS other_booking (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guest_id INT NOT NULL,
      booking_type VARCHAR(100) DEFAULT NULL,
      booking_source VARCHAR(100) DEFAULT NULL,
      booking_reference VARCHAR(255) DEFAULT NULL,
      address TEXT DEFAULT NULL,
      country VARCHAR(120) DEFAULT NULL,
      state VARCHAR(120) DEFAULT NULL,
      city VARCHAR(120) DEFAULT NULL,
      pincode VARCHAR(30) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_other_booking_guest_id (guest_id)
    )
  `);
};

const createOtherBooking = async (data, callback) => {
  const guestId = Number(data.guest_id || data.booking_id);

  if (!guestId) {
    callback(new Error("Guest ID is required"));
    return;
  }

  try {
    const sql = `
      INSERT INTO other_booking
      (guest_id, booking_type, booking_source, booking_reference, address, country, state, city, pincode)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        booking_type = VALUES(booking_type),
        booking_source = VALUES(booking_source),
        booking_reference = VALUES(booking_reference),
        address = VALUES(address),
        country = VALUES(country),
        state = VALUES(state),
        city = VALUES(city),
        pincode = VALUES(pincode)
    `;

    db.query(
      sql,
      [
        guestId,
        data.bookingType || null,
        data.bookingSource || null,
        data.bookingReference || null,
        data.address || null,
        data.country || null,
        data.state || null,
        data.city || null,
        data.pincode || null,
      ],
      callback,
    );
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  createOtherBooking,
  ensureSchema,
};
