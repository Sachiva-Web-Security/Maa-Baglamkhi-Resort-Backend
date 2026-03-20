const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

let hallRateColumnPromise = null;
const getHallRateColumn = async () => {
  if (!hallRateColumnPromise) {
    hallRateColumnPromise = (async () => {
      const snake = await runQuery("SHOW COLUMNS FROM banquet_halls LIKE ?", ["rate_per_hour"]);
      if (snake.length) return "rate_per_hour";

      const camel = await runQuery("SHOW COLUMNS FROM banquet_halls LIKE ?", ["ratePerHour"]);
      if (camel.length) return "ratePerHour";

      throw new Error("Neither rate_per_hour nor ratePerHour exists in banquet_halls");
    })();
  }

  return hallRateColumnPromise;
};

const hasTimeOverlap = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
};

// GET /banquet
const getBanquetDashboard = async (req, res) => {
  try {
    const hallRateColumn = await getHallRateColumn();
    const halls = await runQuery(`
      SELECT 
        id,
        name,
        capacity,
        ${hallRateColumn} AS ratePerHour,
        is_ac,
        image,
        status
      FROM banquet_halls
      ORDER BY id DESC
    `);

    const bookings = await runQuery(`
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

    const formattedBookings = bookings.map((b) => ({
      id: b.id,
      hallId: b.hall_id,
      hallName: b.hallName,
      customerName: b.customer_name,
      phone: b.phone,
      guestEmail: b.guest_email,
      eventTitle: b.event_title,
      eventType: b.event_type,
      guests: b.guests,
      menuPackageId: b.menu_package_id,
      mealSection: b.meal_section,
      customMenuItems: b.custom_menu_items,
      lightingSystem: b.lighting_system,
      decorationFee: Number(b.decoration_fee || 0),
      notes: b.notes,
      date: b.date,
      startTime: b.start_time,
      endTime: b.end_time,
      discount: Number(b.discount || 0),
      gstPercent: Number(b.gst_percent || 5),
      invoiceNo: b.invoice_no,
      status: b.status,
      advance: Number(b.advance || 0),
    }));

    res.status(200).json({
      halls,
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error("getBanquetDashboard error:", error);
    res.status(500).json({ message: "Failed to load banquet data" });
  }
};

// POST /banquet
const createBanquetBooking = async (req, res) => {
  try {
    const {
      hallId,
      customerName,
      phone,
      guestEmail,
      eventTitle,
      eventType,
      guests,
      menuPackageId,
      mealSection,
      customMenuItems,
      lightingSystem,
      decorationFee,
      notes,
      date,
      startTime,
      endTime,
      discount,
      gstPercent,
      advance,
    } = req.body;

    if (!hallId || !customerName || !eventType || !guests || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    const hallRows = await runQuery("SELECT id FROM banquet_halls WHERE id = ? LIMIT 1", [hallId]);
    if (!hallRows.length) {
      return res.status(400).json({ message: "Invalid hallId" });
    }

    const conflicts = await runQuery(
      `
      SELECT id, start_time, end_time
      FROM banquet_bookings
      WHERE hall_id = ?
        AND date = ?
        AND status IN ('Confirmed', 'Completed', 'Billed')
      `,
      [hallId, date]
    );

    const overlapping = conflicts.some((row) =>
      hasTimeOverlap(startTime, endTime, row.start_time, row.end_time)
    );

    if (overlapping) {
      return res.status(409).json({
        message: "Selected hall is already booked for the chosen time slot",
      });
    }

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
        advance,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        hallId,
        customerName,
        phone || "",
        guestEmail || "",
        eventTitle || "",
        eventType,
        Number(guests),
        menuPackageId || "standard",
        mealSection || "",
        customMenuItems || "",
        lightingSystem || "classic",
        Number(decorationFee || 0),
        notes || "",
        date,
        startTime,
        endTime,
        Number(discount || 0),
        Number(gstPercent || 5),
        Number(advance || 0),
        "Confirmed",
      ]
    );

    res.status(201).json({
      message: "Banquet booking created successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("createBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to create booking" });
  }
};

// PUT /banquet/:id/complete
const completeBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await runQuery(
      `UPDATE banquet_bookings SET status = 'Completed' WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Booking marked as completed" });
  } catch (error) {
    console.error("completeBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to update booking status" });
  }
};

// PUT /banquet/:id/bill
const generateBanquetBill = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceNo } = req.body;

    if (!invoiceNo) {
      return res.status(400).json({ message: "invoiceNo is required" });
    }

    const result = await runQuery(
      `
      UPDATE banquet_bookings
      SET invoice_no = ?, status = 'Billed'
      WHERE id = ?
      `,
      [invoiceNo, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Bill generated successfully" });
  } catch (error) {
    console.error("generateBanquetBill error:", error);
    res.status(500).json({ message: "Failed to generate bill" });
  }
};

// POST /banquet/halls
const addBanquetHall = async (req, res) => {
  try {
    const hallRateColumn = await getHallRateColumn();
    const { name, capacity, ratePerHour, is_ac, image } = req.body;

    if (!name || !capacity || !ratePerHour) {
      return res.status(400).json({
        message: "name, capacity and ratePerHour are required",
      });
    }

    const result = await runQuery(
      `
      INSERT INTO banquet_halls (name, capacity, ${hallRateColumn}, is_ac, image, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        Number(capacity),
        Number(ratePerHour),
        is_ac ? 1 : 0,
        image || null,
        "Available",
      ]
    );

    const rows = await runQuery(
      `SELECT id, name, capacity, ${hallRateColumn} AS ratePerHour, is_ac, image, status FROM banquet_halls WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: "Hall added successfully",
      hall: rows[0],
    });
  } catch (error) {
    console.error("addBanquetHall error:", error);
    res.status(500).json({ message: "Failed to add banquet hall" });
  }
};

module.exports = {
  getBanquetDashboard,
  createBanquetBooking,
  completeBanquetBooking,
  generateBanquetBill,
  addBanquetHall,
};
