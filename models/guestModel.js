const db = require("../config/db");

const createGuest = (data, callback) => {

const sql = `
INSERT INTO guests
(mobile, guest_name, guest_email, check_in, check_out, arrival, departure, booking_status)
VALUES (?,?,?,?,?,?,?,?)
`;

db.query(sql,[
data.mobile,
data.guestName,
data.guestEmail,
data.checkIn,
data.checkOut,
data.arrival,
data.departure,
data.bookingStatus
],callback)

}

module.exports = {
createGuest
}