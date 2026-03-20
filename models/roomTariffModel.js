// models/roomTariffModel.js

const db = require("../config/db");

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
    (err, result) => {
      if (err) {
        console.error("❌ DB ERROR (TARIFF):", err);
        return callback(err);
      }
      callback(null, result);
    }
  );
};

module.exports = {
  addTariff,
};