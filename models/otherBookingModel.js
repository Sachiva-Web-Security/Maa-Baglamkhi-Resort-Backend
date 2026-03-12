const db = require("../config/db");

const createOtherBooking = (data, callback) => {

const sql = `
INSERT INTO other_booking
(guest_id, booking_type, booking_source, booking_reference, address, country, state, city, pincode)
VALUES (?,?,?,?,?,?,?,?,?)
`;

db.query(sql,[
data.booking_id,
data.bookingType,
data.bookingSource,
data.bookingReference,
data.address,
data.country,
data.state,
data.city,
data.pincode
],callback)

}

module.exports = {
createOtherBooking
}