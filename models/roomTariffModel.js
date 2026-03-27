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

const addTariff = (data, callback) => {
  if (!data.roomNumber) {
    return callback(new Error("Room number required"));
  }

  const sql = `
    INSERT INTO room_tariff
    (booking_id, room_number, date, quantity, tariff, gst, total)
    VALUES (?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [
      data.booking_id,
      data.roomNumber,
      data.date,
      data.quantity,
      data.tariff,
      data.gstPercent,
      data.total,
    ],
    callback,
  );
};

module.exports = {
  ensureSchema,
  addTariff,
};
