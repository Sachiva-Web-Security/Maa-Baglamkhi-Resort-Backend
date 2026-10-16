// models/GroupBookingModel.js
// v4: group metadata hangs off `bookings` (the legacy `guests` table is gone).
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });

const tableExists = async (tableName) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const ensureSchema = async () => {
  if (!(await tableExists("bookings"))) return;

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_group_bookings (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      booking_id   BIGINT UNSIGNED NOT NULL UNIQUE,
      group_label  VARCHAR(200) DEFAULT NULL,
      total_rooms  INT NOT NULL DEFAULT 1,
      grand_total  DECIMAL(10,2) NOT NULL DEFAULT 0,
      paid_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    )
  `);
};

const create = (data) => {
  const sql = `
    INSERT INTO hotel_group_bookings (booking_id, group_label, total_rooms, grand_total, paid_amount)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      group_label = VALUES(group_label),
      total_rooms = VALUES(total_rooms),
      grand_total = VALUES(grand_total),
      paid_amount = VALUES(paid_amount)
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
