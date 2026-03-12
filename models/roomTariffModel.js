const db = require("../config/db");

const addTariff = (data, callback) => {

const sql = `
INSERT INTO room_tariff
(guest_id, room_number, date, quantity, tariff, gst, total)
VALUES (?,?,?,?,?,?,?)
`;

db.query(sql,[
data.booking_id,
data.roomNumber,
data.date,
data.quantity,
data.tariff,
data.gstPercent,
data.total
],callback)

}

module.exports = {
addTariff
}