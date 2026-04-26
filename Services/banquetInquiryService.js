const db = require("../config/db");
const dbPromise = db.promise();
const BanquetInquiryModel = require("../models/banquetInquiryModel");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const ACTIVE_BANQUET_BOOKING_STATUSES = ["Confirmed", "Completed", "Billed"];

const normalizeText = (value) => String(value || "").trim();
const toNumber = (value) => Number(value || 0);

const hasTimeOverlap = (startA, endA, startB, endB) => {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
};

const calculateDurationHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const [startHour = 0, startMinute = 0] = String(startTime).split(":").map(Number);
  const [endHour = 0, endMinute = 0] = String(endTime).split(":").map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  if (endTotalMinutes <= startTotalMinutes) return 0;

  return Number(((endTotalMinutes - startTotalMinutes) / 60).toFixed(2));
};

let razorpayClient = null;

const getRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw { status: 500, message: "Razorpay credentials are not configured" };
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayClient;
};

const normalizeBookingPayload = (data = {}) => ({
  hallId: toNumber(data.hallId || data.preferredHallId),
  customerName: normalizeText(data.customerName || data.name),
  phone: normalizeText(data.phone || data.phoneNumber),
  guestEmail: normalizeText(data.guestEmail || data.email || data.emailAddress),
  eventTitle: normalizeText(data.eventTitle),
  eventType: normalizeText(data.eventType),
  guests: toNumber(data.guests || data.guestCount || data.expectedGuests),
  date: normalizeText(data.date || data.eventDate),
  startTime: normalizeText(data.startTime),
  endTime: normalizeText(data.endTime),
  notes: normalizeText(data.notes || data.message),
  menuPackageId: normalizeText(data.menuPackageId) || "standard",
  mealSection: normalizeText(data.mealSection),
  customMenuItems: normalizeText(data.customMenuItems),
  lightingSystem: normalizeText(data.lightingSystem) || "classic",
  decorationFee: toNumber(data.decorationFee),
  advance: toNumber(data.advance),
  discount: toNumber(data.discount),
  gstPercent: toNumber(data.gstPercent || 5),
  paymentMode: normalizeText(data.paymentMode || "pay_later"),
  paymentReferenceNo: normalizeText(data.paymentReferenceNo),
});

const BanquetInquiryService = {
  async getAllInquiries() {
    return BanquetInquiryModel.getAllInquiries();
  },

  async getHalls() {
    const [rows] = await dbPromise.query(`
      SELECT id, name, capacity, rate_per_hour AS ratePerHour,
             is_ac, image, status
      FROM banquet_halls
      WHERE status = 'Available'
    `);

    return rows;
  },

  async getConfig() {
    const [rows] = await dbPromise.query(`
      SELECT * FROM banquet_pricing_config LIMIT 1
    `);
    return rows[0] || {};
  },

  async checkAvailability({ date, startTime, endTime }) {
    const [halls] = await dbPromise.query(`
      SELECT id, name FROM banquet_halls WHERE status = 'Available'
    `);

    const [bookings] = await dbPromise.query(
      `
      SELECT hall_id, start_time, end_time
      FROM banquet_bookings
      WHERE date = ?
        AND status IN ('Confirmed', 'Completed', 'Billed')
        AND (? < end_time AND ? > start_time)
      `,
      [date, startTime, endTime]
    );

    const bookedHallIds = bookings.map((b) => b.hall_id);

    const available = halls.filter((h) => !bookedHallIds.includes(h.id));
    const unavailable = halls.filter((h) => bookedHallIds.includes(h.id));

    return { available, unavailable };
  },

  validateInquiry(data) {
    const errors = [];

    if (!data.name) errors.push("Name is required");
    if (!data.email) errors.push("Email is required");
    if (!data.eventDate) errors.push("Event date is required");
    if (!data.eventType) errors.push("Event type is required");
    if (!data.guestCount) errors.push("Guest count is required");

    return errors;
  },

  validateBooking(data) {
    const errors = [];

    if (!data.hallId) errors.push("Preferred hall is required");
    if (!data.customerName) errors.push("Customer name is required");
    if (!data.guestEmail) errors.push("Email is required");
    if (!data.date) errors.push("Event date is required");
    if (!data.eventType) errors.push("Event type is required");
    if (!data.guests) errors.push("Guest count is required");
    if (!data.startTime) errors.push("Start time is required");
    if (!data.endTime) errors.push("End time is required");

    if (data.endTime && data.startTime && data.endTime <= data.startTime) {
      errors.push("End time must be after start time");
    }

    if (data.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.guestEmail)) {
      errors.push("Valid email is required");
    }

    if (data.phone && !/^\+?[0-9\s-]{8,15}$/.test(data.phone)) {
      errors.push("Valid phone number is required");
    }

    return errors;
  },

  async createInquiry(data) {
    const errors = this.validateInquiry(data);
    if (errors.length) {
      throw { status: 400, message: errors };
    }

    return BanquetInquiryModel.createInquiry(data);
  },

  async createWebsiteBooking(data) {
    const payload = normalizeBookingPayload(data);
    const errors = this.validateBooking(payload);

    if (errors.length) {
      throw { status: 400, message: errors };
    }

    const [hallRows] = await dbPromise.query(
      `
      SELECT id, name, capacity, rate_per_hour AS ratePerHour, is_ac, status
      FROM banquet_halls
      WHERE id = ?
      LIMIT 1
      `,
      [payload.hallId],
    );

    const hall = hallRows[0];
    if (!hall) {
      throw { status: 400, message: "Selected hall was not found" };
    }

    if (String(hall.status || "").toLowerCase() !== "available") {
      throw { status: 409, message: "Selected hall is not available for website booking" };
    }

    if (payload.guests > Number(hall.capacity || 0)) {
      throw {
        status: 400,
        message: `Selected hall supports up to ${hall.capacity} guests only`,
      };
    }

    const [conflictingBookings] = await dbPromise.query(
      `
      SELECT id, start_time AS startTime, end_time AS endTime
      FROM banquet_bookings
      WHERE hall_id = ?
        AND date = ?
        AND status IN (${ACTIVE_BANQUET_BOOKING_STATUSES.map(() => "?").join(", ")})
      `,
      [payload.hallId, payload.date, ...ACTIVE_BANQUET_BOOKING_STATUSES],
    );

    const hasConflict = conflictingBookings.some((booking) =>
      hasTimeOverlap(payload.startTime, payload.endTime, booking.startTime, booking.endTime),
    );

    if (hasConflict) {
      throw {
        status: 409,
        message: "Selected hall is already booked for the chosen date and time",
      };
    }

    const durationHours = calculateDurationHours(payload.startTime, payload.endTime);
    const baseHallCharge = durationHours > 0 ? Number(hall.ratePerHour || 0) * durationHours : 0;
    const hallCharge = Number(baseHallCharge.toFixed(2));
    const subtotalAmount = Math.max(0, hallCharge - payload.discount);
    const gstAmount = Number(((subtotalAmount * payload.gstPercent) / 100).toFixed(2));
    const grandTotal = Number((subtotalAmount + gstAmount).toFixed(2));
    const advance = Math.max(0, payload.advance);
    const netReceived = advance;
    const balanceDue = Math.max(0, grandTotal - netReceived);
    const paymentStatus = advance >= grandTotal && grandTotal > 0 ? "Paid" : advance > 0 ? "Partial" : "Pending";
    const paymentMode = payload.paymentMode === "online" ? "online" : "pay_later";
    const bookingStatus = paymentMode === "online" ? "Confirmed" : "Confirmed";
    const websiteNotes = [
      payload.notes,
      "Website banquet booking",
      payload.paymentReferenceNo ? `Payment Ref: ${payload.paymentReferenceNo}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const [result] = await dbPromise.query(
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
        custom_menu_charge,
        lighting_charge,
        event_support_fee,
        hall_charge,
        meal_charge,
        decoration_fee,
        notes,
        date,
        start_time,
        end_time,
        discount,
        gst_percent,
        subtotal_amount,
        gst_amount,
        grand_total,
        invoice_no,
        status,
        advance,
        refund_amount,
        net_received,
        balance_due,
        payment_mode,
        payment_status,
        payment_reference_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.hallId,
        payload.customerName,
        payload.phone || "",
        payload.guestEmail || "",
        payload.eventTitle || "",
        payload.eventType,
        payload.guests,
        payload.menuPackageId,
        payload.mealSection || "",
        payload.customMenuItems || "",
        payload.lightingSystem,
        0,
        0,
        0,
        hallCharge,
        0,
        payload.decorationFee,
        websiteNotes,
        payload.date,
        payload.startTime,
        payload.endTime,
        payload.discount,
        payload.gstPercent,
        subtotalAmount,
        gstAmount,
        grandTotal,
        null,
        bookingStatus,
        advance,
        0,
        netReceived,
        balanceDue,
        paymentMode,
        paymentStatus,
        payload.paymentReferenceNo || null,
      ],
    );

    return {
      bookingId: result.insertId,
      hallId: hall.id,
      hallName: hall.name,
      hallCharge,
      subtotalAmount,
      gstAmount,
      grandTotal,
      balanceDue,
      paymentStatus,
      status: bookingStatus,
      paymentMode,
    };
  },

  async getWebsiteBookingById(id) {
    const bookingId = toNumber(id);

    if (!bookingId) {
      throw { status: 400, message: "bookingId is required" };
    }

    const [rows] = await dbPromise.query(
      `
      SELECT
        b.id,
        b.hall_id AS hallId,
        h.name AS hallName,
        h.capacity,
        h.rate_per_hour AS hallRatePerHour,
        h.is_ac,
        h.image,
        b.customer_name AS customerName,
        b.phone,
        b.guest_email AS guestEmail,
        b.event_title AS eventTitle,
        b.event_type AS eventType,
        b.guests,
        b.menu_package_id AS menuPackageId,
        b.meal_section AS mealSection,
        b.custom_menu_items AS customMenuItems,
        b.lighting_system AS lightingSystem,
        b.custom_menu_charge AS customMenuCharge,
        b.lighting_charge AS lightingCharge,
        b.event_support_fee AS eventSupportFee,
        b.hall_charge AS hallCharge,
        b.meal_charge AS mealCharge,
        b.decoration_fee AS decorationFee,
        b.notes,
        b.date,
        b.start_time AS startTime,
        b.end_time AS endTime,
        b.discount,
        b.gst_percent AS gstPercent,
        b.subtotal_amount AS subtotalAmount,
        b.gst_amount AS gstAmount,
        b.grand_total AS grandTotal,
        b.invoice_no AS invoiceNo,
        b.status,
        b.advance,
        b.refund_amount AS refundAmount,
        b.net_received AS netReceived,
        b.balance_due AS balanceDue,
        b.payment_mode AS paymentMode,
        b.payment_status AS paymentStatus,
        b.payment_reference_no AS paymentReferenceNo,
        b.billed_at AS billedAt
      FROM banquet_bookings b
      JOIN banquet_halls h ON b.hall_id = h.id
      WHERE b.id = ?
      LIMIT 1
      `,
      [bookingId],
    );

    const booking = rows[0];
    if (!booking) {
      throw { status: 404, message: "Banquet booking not found" };
    }

    return {
      ...booking,
      hallRatePerHour: Number(booking.hallRatePerHour || 0),
      customMenuCharge: Number(booking.customMenuCharge || 0),
      lightingCharge: Number(booking.lightingCharge || 0),
      eventSupportFee: Number(booking.eventSupportFee || 0),
      hallCharge: Number(booking.hallCharge || 0),
      mealCharge: Number(booking.mealCharge || 0),
      decorationFee: Number(booking.decorationFee || 0),
      discount: Number(booking.discount || 0),
      gstPercent: Number(booking.gstPercent || 0),
      subtotalAmount: Number(booking.subtotalAmount || 0),
      gstAmount: Number(booking.gstAmount || 0),
      grandTotal: Number(booking.grandTotal || 0),
      advance: Number(booking.advance || 0),
      refundAmount: Number(booking.refundAmount || 0),
      netReceived: Number(booking.netReceived || 0),
      balanceDue: Number(booking.balanceDue || 0),
    };
  },

  async createWebsiteBookingPaymentOrder(data = {}) {
    const bookingId = toNumber(data.bookingId);

    if (!bookingId) {
      throw { status: 400, message: "bookingId is required" };
    }

    const [rows] = await dbPromise.query(
      `
      SELECT
        id,
        customer_name AS customerName,
        guest_email AS guestEmail,
        phone,
        event_type AS eventType,
        date,
        start_time AS startTime,
        end_time AS endTime,
        grand_total AS grandTotal,
        payment_status AS paymentStatus,
        status
      FROM banquet_bookings
      WHERE id = ?
      LIMIT 1
      `,
      [bookingId],
    );

    const booking = rows[0];
    if (!booking) {
      throw { status: 404, message: "Banquet booking not found" };
    }

    if (String(booking.paymentStatus || "").toLowerCase() === "paid") {
      throw { status: 409, message: "Banquet booking is already paid" };
    }

    if (String(booking.status || "").toLowerCase() === "cancelled") {
      throw { status: 409, message: "Cancelled booking cannot be paid" };
    }

    const amount = Number(data.amount || booking.grandTotal || 0);
    if (!amount || amount <= 0) {
      throw { status: 400, message: "Valid payment amount is required" };
    }

    const order = await getRazorpayClient().orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `BNQ-${booking.id}`,
      notes: {
        bookingId: String(booking.id),
        eventType: booking.eventType || "",
        eventDate: String(booking.date || ""),
      },
    });

    await dbPromise.query(
      `
      UPDATE banquet_bookings
      SET payment_mode = ?,
          payment_status = ?,
          payment_reference_no = ?
      WHERE id = ?
      `,
      ["online", "Pending", order.id, booking.id],
    );

    return {
      bookingId: booking.id,
      amount,
      currency: order.currency,
      orderId: order.id,
      key: process.env.RAZORPAY_KEY_ID,
      customerName: booking.customerName,
      customerEmail: booking.guestEmail,
      customerPhone: booking.phone,
    };
  },

  async verifyWebsiteBookingPayment(data = {}) {
    const bookingId = toNumber(data.bookingId);
    const razorpayOrderId = normalizeText(data.razorpay_order_id || data.razorpayOrderId);
    const razorpayPaymentId = normalizeText(data.razorpay_payment_id || data.razorpayPaymentId);
    const razorpaySignature = normalizeText(data.razorpay_signature || data.razorpaySignature);

    if (!bookingId) {
      throw { status: 400, message: "bookingId is required" };
    }

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw { status: 400, message: "Payment verification fields are required" };
    }

    const [rows] = await dbPromise.query(
      `
      SELECT id, hall_id AS hallId, date, start_time AS startTime, end_time AS endTime,
             grand_total AS grandTotal, payment_status AS paymentStatus, status
      FROM banquet_bookings
      WHERE id = ?
      LIMIT 1
      `,
      [bookingId],
    );

    const booking = rows[0];
    if (!booking) {
      throw { status: 404, message: "Banquet booking not found" };
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      throw { status: 400, message: "Invalid payment signature" };
    }

    await dbPromise.query(
      `
      UPDATE banquet_bookings
      SET payment_mode = ?,
          payment_status = ?,
          payment_reference_no = ?,
          advance = ?,
          net_received = ?,
          balance_due = ?,
          status = ?
      WHERE id = ?
      `,
      [
        "online",
        "Paid",
        razorpayPaymentId,
        Number(booking.grandTotal || 0),
        Number(booking.grandTotal || 0),
        0,
        String(booking.status || "").toLowerCase() === "cancelled" ? "Confirmed" : booking.status || "Confirmed",
        booking.id,
      ],
    );

    return {
      bookingId: booking.id,
      paymentStatus: "Paid",
      bookingStatus: booking.status || "Confirmed",
      paymentReferenceNo: razorpayPaymentId,
    };
  },

  async cancelWebsiteBookingPayment(data = {}) {
    const bookingId = toNumber(data.bookingId);

    if (!bookingId) {
      throw { status: 400, message: "bookingId is required" };
    }

    const [rows] = await dbPromise.query(
      `
      SELECT id, payment_status AS paymentStatus, status
      FROM banquet_bookings
      WHERE id = ?
      LIMIT 1
      `,
      [bookingId],
    );

    const booking = rows[0];
    if (!booking) {
      throw { status: 404, message: "Banquet booking not found" };
    }

    if (String(booking.paymentStatus || "").toLowerCase() === "paid") {
      return {
        bookingId: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        cancelled: false,
      };
    }

    await dbPromise.query(
      `
      UPDATE banquet_bookings
      SET status = 'Cancelled',
          payment_status = 'Failed'
      WHERE id = ?
      `,
      [booking.id],
    );

    return {
      bookingId: booking.id,
      status: "Cancelled",
      paymentStatus: "Failed",
      cancelled: true,
    };
  },
};

module.exports = BanquetInquiryService;
