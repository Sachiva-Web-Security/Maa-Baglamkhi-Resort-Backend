const db = require("../config/db");

// Rooms
const getRooms = (callback) => {
  const sql =
    "SELECT id, room_number AS number, status, guest, check_in, check_out FROM rooms ORDER BY room_number";
  db.query(sql, callback);
};

// Bookings
const getBookings = (callback) => {
  const sql =
    "SELECT id, guest_name AS guestName, room_number AS room, check_in, check_out, status FROM hotel_bookings ORDER BY id DESC";
  db.query(sql, callback);
};

const createBooking = (data, callback) => {
  const sql =
    "INSERT INTO hotel_bookings (guest_name, room_number, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)";
  db.query(
    sql,
    [
      data.guestName,
      data.room,
      data.checkIn,
      data.checkOut,
      data.status || "Occupied",
    ],
    callback
  );
};

const updateRoomForBooking = (data, callback) => {
  const sql =
    "UPDATE rooms SET status = ?, guest = ?, check_in = ?, check_out = ? WHERE room_number = ?";
  db.query(
    sql,
    [data.status, data.guestName, data.checkIn, data.checkOut, data.room],
    callback
  );
};

const checkoutBooking = (bookingId, callback) => {
  const sql = "UPDATE hotel_bookings SET status = 'CheckedOut' WHERE id = ?";
  db.query(sql, [bookingId], callback);
};

const setRoomCleaning = (roomNumber, callback) => {
  const sql =
    "UPDATE rooms SET status = 'Cleaning', guest = NULL, check_in = NULL, check_out = NULL WHERE room_number = ?";
  db.query(sql, [roomNumber], callback);
};

module.exports = {
  getRooms,
  getBookings,
  createBooking,
  updateRoomForBooking,
  checkoutBooking,
  setRoomCleaning,
};

