const db = require("../config/db");

const getHalls = (callback) => {
  db.query(
    "SELECT id, code, name, capacity, rate_per_hour AS ratePerHour, status FROM banquet_halls",
    callback
  );
};

const getBookings = (callback) => {
  const sql =
    "SELECT b.*, h.name AS hallName, h.code AS hallCode FROM banquet_bookings b JOIN banquet_halls h ON b.hall_id = h.id ORDER BY b.date DESC, b.id DESC";
  db.query(sql, callback);
};

const createBooking = (data, callback) => {
  const sql =
    "INSERT INTO banquet_bookings (hall_id, customer_name, phone, event_type, guests, menu_package_id, decoration_fee, notes, date, start_time, end_time, discount, gst_percent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  db.query(
    sql,
    [
      data.hallId,
      data.customerName,
      data.phone,
      data.eventType,
      data.guests,
      data.menuPackageId,
      data.decorationFee,
      data.notes || "",
      data.date,
      data.startTime,
      data.endTime,
      data.discount || 0,
      data.gstPercent || 5,
      "Confirmed",
    ],
    callback
  );
};

const markCompleted = (id, callback) => {
  db.query("UPDATE banquet_bookings SET status='Completed' WHERE id=?", [id], callback);
};

const markBilled = (id, invoiceNo, callback) => {
  db.query(
    "UPDATE banquet_bookings SET status='Billed', invoice_no=? WHERE id=?",
    [invoiceNo, id],
    callback
  );
};

module.exports = {
  getHalls,
  getBookings,
  createBooking,
  markCompleted,
  markBilled,
};

