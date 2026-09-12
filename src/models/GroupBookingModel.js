// models/GroupBookingModel.js
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_group_bookings (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      booking_id   INT NOT NULL UNIQUE,
      group_label  VARCHAR(200) DEFAULT NULL,
      total_rooms  INT NOT NULL DEFAULT 1,
      grand_total  DECIMAL(10,2) NOT NULL DEFAULT 0,
      paid_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES guests(id) ON DELETE CASCADE
    )
  `);

  const col1 = await runQuery("SHOW COLUMNS FROM guests LIKE 'is_group_booking'");
  if (!Array.isArray(col1) || col1.length === 0) {
    await runQuery("ALTER TABLE guests ADD COLUMN is_group_booking TINYINT(1) NOT NULL DEFAULT 0");
  }

  const col2 = await runQuery("SHOW COLUMNS FROM guests LIKE 'group_label'");
  if (!Array.isArray(col2) || col2.length === 0) {
    await runQuery("ALTER TABLE guests ADD COLUMN group_label VARCHAR(200) DEFAULT NULL");
  }
};

const create = (data) => {
  const sql = `
    INSERT INTO hotel_group_bookings (booking_id, group_label, total_rooms, grand_total, paid_amount)
    VALUES (?, ?, ?, ?, ?)
  `;
  return runQuery(sql, [
    data.booking_id,
    data.group_label || null,
    data.total_rooms || 1,
    data.grand_total || 0,
    data.paid_amount || 0,
  ]);
};

const findByBookingId = (bookingId) => {
  return runQuery("SELECT * FROM hotel_group_bookings WHERE booking_id = ?", [bookingId]);
};

const updatePayment = (bookingId, paidAmount) => {
  return runQuery(
    "UPDATE hotel_group_bookings SET paid_amount = ? WHERE booking_id = ?",
    [paidAmount, bookingId]
  );
};

const remove = (bookingId) => {
  return runQuery("DELETE FROM hotel_group_bookings WHERE booking_id = ?", [bookingId]);
};

module.exports = {
  ensureSchema,
  create,
  findByBookingId,
  updatePayment,
  remove,
};
