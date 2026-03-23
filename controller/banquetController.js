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

const extractMeta = (notes = "") => {
  const match = String(notes).match(/\[\[BNQ_META\]\](.*?)\[\[\/BNQ_META\]\]/);
  if (!match?.[1]) return {};

  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
};

const stripMeta = (notes = "") =>
  String(notes).replace(/\s*\[\[BNQ_META\]\].*?\[\[\/BNQ_META\]\]/, "").trim();

const sanitizeBookingMeta = (meta = {}) => {
  const nextMeta = { ...meta };

  // Receipt previews can be very large base64 strings and overflow the notes column.
  delete nextMeta.receiptFileDataUrl;

  return nextMeta;
};

const buildNotesPayload = (notes, meta) =>
  `${String(notes || "").trim()}\n[[BNQ_META]]${JSON.stringify(
    sanitizeBookingMeta(meta)
  )}[[/BNQ_META]]`.trim();

const getBookingById = async (id) => {
  const rows = await runQuery(
    `
    SELECT id, status, notes, advance
    FROM banquet_bookings
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

const normalizeBookingPayload = (body = {}) => ({
  hallId: body.hallId,
  customerName: body.customerName,
  phone: body.phone || "",
  guestEmail: body.guestEmail || "",
  eventTitle: body.eventTitle || "",
  eventType: body.eventType,
  guests: Number(body.guests || 0),
  menuPackageId: body.menuPackageId || "standard",
  mealSection: body.mealSection || "",
  customMenuItems: body.customMenuItems || "",
  lightingSystem: body.lightingSystem || "classic",
  decorationFee: Number(body.decorationFee || 0),
  notes: body.notes || "",
  date: body.date,
  startTime: body.startTime,
  endTime: body.endTime,
  discount: Number(body.discount || 0),
  gstPercent: Number(body.gstPercent || 5),
  advance: Number(body.advance ?? body.paymentReceived ?? 0),
});

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
    } = normalizeBookingPayload(req.body);

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
    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "Confirmed" && booking.status !== "Billed") {
      return res.status(400).json({
        message: "Sirf confirmed ya billed booking ko complete kiya ja sakta hai",
      });
    }

    const result = await runQuery(
      `UPDATE banquet_bookings SET status = 'Completed' WHERE id = ?`,
      [id]
    );

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
    const booking = await getBookingById(id);

    if (!invoiceNo) {
      return res.status(400).json({ message: "invoiceNo is required" });
    }

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!["Confirmed", "Completed", "Billed"].includes(booking.status)) {
      return res.status(400).json({
        message: "Sirf active booking ke liye bill generate kiya ja sakta hai",
      });
    }

    const result = await runQuery(
      `
      UPDATE banquet_bookings
      SET invoice_no = ?, status = 'Billed'
      WHERE id = ?
      `,
      [invoiceNo, id]
    );

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

// PUT /banquet/:id/cancel
const cancelBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (["Cancelled", "Refunded"].includes(booking.status)) {
      return res.status(400).json({
        message: "Booking already cancelled ya refunded hai",
      });
    }

    const result = await runQuery(
      `UPDATE banquet_bookings SET status = 'Cancelled' WHERE id = ?`,
      [id]
    );

    res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (error) {
    console.error("cancelBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
};

// PUT /banquet/:id/refund
const refundBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedRefund = Number(req.body?.refundAmount || 0);

    if (requestedRefund <= 0) {
      return res.status(400).json({ message: "Valid refundAmount is required" });
    }

    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const existingMeta = extractMeta(booking.notes || "");
    const existingRefund = Number(existingMeta.refundAmount || 0);
    const advance = Number(booking.advance || 0);
    const totalRefund = existingRefund + requestedRefund;

    if (totalRefund > advance) {
      return res.status(400).json({
        message: "Refund amount received payment se zyada nahi ho sakta",
      });
    }

    const updatedMeta = {
      ...existingMeta,
      refundAmount: totalRefund,
    };
    const nextStatus =
      booking.status === "Cancelled" && totalRefund >= advance
        ? "Refunded"
        : booking.status;

    const result = await runQuery(
      `
      UPDATE banquet_bookings
      SET notes = ?, status = ?
      WHERE id = ?
      `,
      [buildNotesPayload(stripMeta(booking.notes || ""), updatedMeta), nextStatus, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({
      message: "Refund updated successfully",
      refundAmount: totalRefund,
      status: nextStatus,
    });
  } catch (error) {
    console.error("refundBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to refund booking" });
  }
};

// PUT /banquet/:id
const updateBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;
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
    } = normalizeBookingPayload(req.body);

    if (!hallId || !customerName || !eventType || !guests || !date || !startTime || !endTime) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    const booking = await getBookingById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status === "Refunded") {
      return res.status(400).json({
        message: "Refunded booking ko update nahi kiya ja sakta",
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
        AND id <> ?
        AND status IN ('Confirmed', 'Completed', 'Billed')
      `,
      [hallId, date, id]
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
      UPDATE banquet_bookings
      SET
        hall_id = ?,
        customer_name = ?,
        phone = ?,
        guest_email = ?,
        event_title = ?,
        event_type = ?,
        guests = ?,
        menu_package_id = ?,
        meal_section = ?,
        custom_menu_items = ?,
        lighting_system = ?,
        decoration_fee = ?,
        notes = ?,
        date = ?,
        start_time = ?,
        end_time = ?,
        discount = ?,
        gst_percent = ?,
        advance = ?
      WHERE id = ?
      `,
      [
        hallId,
        customerName,
        phone,
        guestEmail,
        eventTitle,
        eventType,
        Number(guests),
        menuPackageId,
        mealSection,
        customMenuItems,
        lightingSystem,
        Number(decorationFee || 0),
        notes,
        date,
        startTime,
        endTime,
        Number(discount || 0),
        Number(gstPercent || 5),
        Number(advance || 0),
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.status(200).json({ message: "Booking updated successfully" });
  } catch (error) {
    console.error("updateBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to update booking" });
  }
};

// PUT /banquet/halls/:id
const updateBanquetHall = async (req, res) => {
  try {
    const hallRateColumn = await getHallRateColumn();
    const { id } = req.params;
    const { name, capacity, ratePerHour, is_ac, image, status } = req.body;

    if (!name || !capacity || !ratePerHour) {
      return res.status(400).json({
        message: "name, capacity and ratePerHour are required",
      });
    }

    const result = await runQuery(
      `
      UPDATE banquet_halls
      SET name = ?, capacity = ?, ${hallRateColumn} = ?, is_ac = ?, image = ?, status = ?
      WHERE id = ?
      `,
      [
        name,
        Number(capacity),
        Number(ratePerHour),
        is_ac ? 1 : 0,
        image || null,
        status || "Available",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Hall not found" });
    }

    const rows = await runQuery(
      `SELECT id, name, capacity, ${hallRateColumn} AS ratePerHour, is_ac, image, status FROM banquet_halls WHERE id = ?`,
      [id]
    );

    res.status(200).json({
      message: "Hall updated successfully",
      hall: rows[0],
    });
  } catch (error) {
    console.error("updateBanquetHall error:", error);
    res.status(500).json({ message: "Failed to update banquet hall" });
  }
};

// DELETE /banquet/:id
const deleteBanquetBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "Cancelled") {
      return res.status(400).json({
        message: "Delete sirf cancelled booking ke liye allowed hai",
      });
    }

    const result = await runQuery(`DELETE FROM banquet_bookings WHERE id = ?`, [id]);

    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("deleteBanquetBooking error:", error);
    res.status(500).json({ message: "Failed to delete booking" });
  }
};

// DELETE /banquet/halls/:id
const deleteBanquetHall = async (req, res) => {
  try {
    const { id } = req.params;

    const bookingRows = await runQuery(
      `
      SELECT id
      FROM banquet_bookings
      WHERE hall_id = ?
      LIMIT 1
      `,
      [id]
    );

    if (bookingRows.length) {
      return res.status(409).json({
        message: "Is hall se bookings linked hain. Delete se pehle un bookings ko hataiye ya shift kijiye.",
      });
    }

    const result = await runQuery(`DELETE FROM banquet_halls WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Hall not found" });
    }

    res.status(200).json({ message: "Hall deleted successfully" });
  } catch (error) {
    console.error("deleteBanquetHall error:", error);
    res.status(500).json({ message: "Failed to delete banquet hall" });
  }
};

module.exports = {
  getBanquetDashboard,
  createBanquetBooking,
  updateBanquetBooking,
  completeBanquetBooking,
  cancelBanquetBooking,
  refundBanquetBooking,
  generateBanquetBill,
  deleteBanquetBooking,
  addBanquetHall,
  updateBanquetHall,
  deleteBanquetHall,
};
