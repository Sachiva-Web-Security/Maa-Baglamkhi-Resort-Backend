const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS banquet_halls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      capacity INT NOT NULL DEFAULT 0,
      rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_ac TINYINT(1) NOT NULL DEFAULT 0,
      image VARCHAR(255) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Available'
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS banquet_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hall_id INT NOT NULL,
      customer_name VARCHAR(191) NOT NULL,
      phone VARCHAR(50) DEFAULT '',
      guest_email VARCHAR(191) DEFAULT '',
      event_title VARCHAR(191) DEFAULT '',
      event_type VARCHAR(100) NOT NULL,
      guests INT NOT NULL DEFAULT 0,
      menu_package_id VARCHAR(100) DEFAULT 'standard',
      meal_section VARCHAR(100) DEFAULT '',
      custom_menu_items TEXT DEFAULT NULL,
      lighting_system VARCHAR(100) DEFAULT 'classic',
      decoration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT NULL,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst_percent DECIMAL(10,2) NOT NULL DEFAULT 5,
      invoice_no VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Confirmed',
      advance DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `);
};

const getAllHalls = async () => {
  const rows = await runQuery(`
    SELECT 
      id,
      name,
      capacity,
      rate_per_hour AS ratePerHour,
      is_ac,
      image,
      status
    FROM banquet_halls
    ORDER BY id DESC
  `);

  return rows;
};

const createHall = async ({ name, capacity, ratePerHour, is_ac, image }) => {
  const result = await runQuery(
    `
    INSERT INTO banquet_halls (
      name,
      capacity,
      rate_per_hour,
      is_ac,
      image,
      status
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [name, Number(capacity), Number(ratePerHour), is_ac ? 1 : 0, image || null, "Available"],
  );

  const rows = await runQuery("SELECT * FROM banquet_halls WHERE id = ?", [result.insertId]);
  return rows[0];
};

const getAllBookings = async () => {
  const rows = await runQuery(`
    SELECT
      b.id,
      b.hall_id,
      h.name AS hallName,
      b.customer_name,
      b.phone,
      b.guest_email,
      b.event_title,
      b.event_type,
      b.guests,
      b.menu_package_id,
      b.meal_section,
      b.custom_menu_items,
      b.lighting_system,
      b.decoration_fee,
      b.notes,
      b.date,
      b.start_time,
      b.end_time,
      b.discount,
      b.gst_percent,
      b.invoice_no,
      b.status,
      b.advance
    FROM banquet_bookings b
    JOIN banquet_halls h ON b.hall_id = h.id
    ORDER BY b.id DESC
  `);

  return rows;
};

const checkHallBookingConflict = async ({ hallId, date, startTime, endTime }) => {
  const rows = await runQuery(
    `
    SELECT id
    FROM banquet_bookings
    WHERE hall_id = ?
      AND date = ?
      AND status IN ('Confirmed', 'Completed', 'Billed')
      AND (start_time < ? AND end_time > ?)
    `,
    [hallId, date, endTime, startTime],
  );

  return rows;
};

const createBooking = async (data) => {
  const result = await runQuery(
    `
    INSERT INTO banquet_bookings (
      hall_id,
      customer_name,
      phone,
      guest_email,
      event_title,
      event_type,
      guests,
      menu_package_id,
      meal_section,
      custom_menu_items,
      lighting_system,
      decoration_fee,
      notes,
      date,
      start_time,
      end_time,
      discount,
      gst_percent,
      invoice_no,
      status,
      advance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.hallId,
      data.customerName,
      data.phone || "",
      data.guestEmail || "",
      data.eventTitle || "",
      data.eventType,
      Number(data.guests || 0),
      data.menuPackageId || "standard",
      data.mealSection || "",
      data.customMenuItems || "",
      data.lightingSystem || "classic",
      Number(data.decorationFee || 0),
      data.notes || "",
      data.date,
      data.startTime,
      data.endTime,
      Number(data.discount || 0),
      Number(data.gstPercent || 5),
      data.invoiceNo || "",
      "Confirmed",
      Number(data.advance || 0),
    ],
  );

  return result.insertId;
};

const updateBookingStatus = async (id, status) => {
  const result = await runQuery("UPDATE banquet_bookings SET status = ? WHERE id = ?", [status, id]);
  return result;
};

const updateBookingBill = async (id, invoiceNo) => {
  const result = await runQuery(
    "UPDATE banquet_bookings SET invoice_no = ?, status = 'Billed' WHERE id = ?",
    [invoiceNo, id],
  );
  return result;
};

module.exports = {
  ensureSchema,
  getAllHalls,
  createHall,
  getAllBookings,
  checkHallBookingConflict,
  createBooking,
  updateBookingStatus,
  updateBookingBill,
};
