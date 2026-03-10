const db = require("../config/db");

/* ---- Auto-migrate: add missing columns if needed ---- */
(function migrate() {
  db.query("SHOW COLUMNS FROM banquet_halls LIKE 'image'", (err, rows) => {
    if (!err && rows.length === 0) {
      db.query("ALTER TABLE banquet_halls ADD COLUMN image VARCHAR(255) DEFAULT NULL", (e) => {
        if (e) console.log("Migration (image):", e.message);
        else console.log("Migration: added 'image' column to banquet_halls");
      });
    }
  });
  db.query("SHOW COLUMNS FROM banquet_halls LIKE 'is_ac'", (err, rows) => {
    if (!err && rows.length === 0) {
      db.query("ALTER TABLE banquet_halls ADD COLUMN is_ac BOOLEAN DEFAULT TRUE", (e) => {
        if (e) console.log("Migration (is_ac):", e.message);
        else console.log("Migration: added 'is_ac' column to banquet_halls");
      });
    }
  });
})();
const getHalls = (callback) => {
  db.query(
    "SELECT id, code, name, capacity, rate_per_hour AS ratePerHour, status, image, is_ac FROM banquet_halls",
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

const createHall = (data, callback) => {
  const sql =
    "INSERT INTO banquet_halls (code, name, capacity, rate_per_hour, image, is_ac, status) VALUES (?, ?, ?, ?, ?, ?, ?)";
  db.query(
    sql,
    [
      data.code,
      data.name,
      data.capacity,
      data.ratePerHour,
      data.image || null,
      data.is_ac !== undefined ? data.is_ac : true,
      data.status || "Available",
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
  createHall,
  markCompleted,
  markBilled,
};

