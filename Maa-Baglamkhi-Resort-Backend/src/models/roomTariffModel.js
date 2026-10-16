const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS room_tariff (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      room_number VARCHAR(50) NOT NULL,
      date DATE DEFAULT NULL,
      quantity INT NOT NULL DEFAULT 1,
      category_name VARCHAR(120) DEFAULT 'Room Charge',
      tariff DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `);
};

const addTariff = async (data, callback) => {
  if (!data.roomNumber) {
    callback(new Error("Room number required"));
    return;
  }

  try {

    const bookingId = Number(data.booking_id);
    const roomNumber = String(data.roomNumber).trim();
    const existingRows = await runQuery(
      "SELECT id FROM room_tariff WHERE booking_id = ? AND room_number = ? ORDER BY id DESC LIMIT 1",
      [bookingId, roomNumber],
    );

    if (existingRows.length) {
      db.query(
        `
          UPDATE room_tariff
          SET date = ?, quantity = ?, tariff = ?, gst = ?, total = ?
          WHERE id = ?
        `,
        [
          data.date || null,
          data.quantity,
          data.tariff,
          data.gstPercent,
          data.total,
          existingRows[0].id,
        ],
        callback,
      );
      return;
    }

    db.query(
      `
        INSERT INTO room_tariff
        (booking_id, room_number, date, quantity, tariff, gst, total)
        VALUES (?,?,?,?,?,?,?)
      `,
      [
        bookingId,
        roomNumber,
        data.date || null,
        data.quantity,
        data.tariff,
        data.gstPercent,
        data.total,
      ],
      callback,
    );
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  ensureSchema,
  addTariff,
};
