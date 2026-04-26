const WebsiteTableReservationModel = require("../models/WebsiteTableReservationModel");

const DINING_CONFIG = {
  timeSlots: [
    "12:30 PM - 2:00 PM",
    "2:00 PM - 3:30 PM",
    "7:00 PM - 8:30 PM",
    "8:30 PM - 10:00 PM",
  ],
  guestOptions: ["1 Guest", "2 Guests", "3 Guests", "4 Guests", "5 Guests", "6+ Guests"],
  tableTypes: ["Window Table", "Family Table", "Private Dining", "Celebration Setup"],
  occasions: ["Birthday", "Anniversary", "Family Dinner", "Business Dinner", "Casual Dining"],
  diningNotes: [
    "Reservations are confirmed after availability review",
    "Please arrive 10 minutes early",
    "Large groups may receive a callback",
  ],
  supportItems: [
    {
      icon: "mdi:phone-outline",
      label: "Reservation Desk",
      value: "+91 98765 43210",
    },
    {
      icon: "mdi:email-outline",
      label: "Dining Concierge",
      value: "dining@hotelgrand.example",
    },
    {
      icon: "mdi:clock-check-outline",
      label: "Response Window",
      value: "Typically within 30 minutes",
    },
  ],
};

const ACTIVE_SLOT_STATUSES = new Set(["Pending", "Confirmed", "Seated"]);
const SLOT_LIMITS = {
  default: { reservationLimit: 20, guestLimit: 80 },
  "12:30 PM - 2:00 PM": { reservationLimit: 16, guestLimit: 64 },
  "2:00 PM - 3:30 PM": { reservationLimit: 12, guestLimit: 48 },
  "7:00 PM - 8:30 PM": { reservationLimit: 20, guestLimit: 90 },
  "8:30 PM - 10:00 PM": { reservationLimit: 16, guestLimit: 72 },
};

const normalizeText = (value) => String(value || "").trim();
const normalizeMobile = (value) => String(value || "").replace(/[^\d+]/g, "").trim();

const toReservationCode = (id) => `DINE-${String(id).padStart(6, "0")}`;

function normalizeGuestCount(value) {
  const match = String(value || "").match(/\d+/);
  if (!match) return 0;
  return Number(match[0]);
}

function validateReservationPayload(data) {
  const payload = {
    customerName: normalizeText(data.customerName || data.fullName),
    mobile: normalizeMobile(data.mobile || data.mobileNumber),
    email: normalizeText(data.email || data.emailAddress),
    reservationDate: normalizeText(data.reservationDate),
    timeSlot: normalizeText(data.timeSlot || data.preferredTimeSlot),
    guestCount: Number(data.guestCount || normalizeGuestCount(data.guests)),
    tablePreference: normalizeText(data.tablePreference),
    occasion: normalizeText(data.occasion),
    specialRequest: normalizeText(data.specialRequest),
    notes: normalizeText(data.notes),
  };

  if (!payload.customerName || payload.customerName.length < 2) {
    throw new Error("Customer name is required");
  }

  if (!payload.mobile || payload.mobile.length < 7) {
    throw new Error("Valid mobile number is required");
  }

  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error("Valid email address is required");
  }

  if (!payload.reservationDate) {
    throw new Error("Reservation date is required");
  }

  if (!payload.timeSlot) {
    throw new Error("Time slot is required");
  }

  if (!payload.guestCount || payload.guestCount < 1) {
    throw new Error("Guest count must be at least 1");
  }

  if (!payload.tablePreference) {
    throw new Error("Table preference is required");
  }

  if (!payload.occasion) {
    throw new Error("Occasion is required");
  }

  return payload;
}

async function ensureSchema() {
  await WebsiteTableReservationModel.ensureSchema();
}

async function getDiningConfig() {
  await ensureSchema();
  return DINING_CONFIG;
}

async function getDiningAvailability(query = {}) {
  await ensureSchema();

  const reservationDate = normalizeText(query.date || query.reservationDate);
  const guestCount = Number(query.guests || query.guestCount || 1);

  if (!reservationDate) {
    throw new Error("Reservation date is required to check availability");
  }

  const slotSummaries = [];

  for (const slot of DINING_CONFIG.timeSlots) {
    const counts = await WebsiteTableReservationModel.countReservationsForSlot({
      reservationDate,
      timeSlot: slot,
    });
    const limits = SLOT_LIMITS[slot] || SLOT_LIMITS.default;
    const remainingReservations = Math.max(limits.reservationLimit - counts.reservationCount, 0);
    const remainingGuests = Math.max(limits.guestLimit - counts.guestCount, 0);
    const available = remainingReservations > 0 && remainingGuests >= guestCount;

    slotSummaries.push({
      timeSlot: slot,
      available,
      reservationCount: counts.reservationCount,
      reservedGuests: counts.guestCount,
      remainingReservations,
      remainingGuests,
    });
  }

  return {
    reservationDate,
    guestCount,
    slots: slotSummaries,
  };
}

async function getAvailableTables(query = {}) {
  await ensureSchema();

  const reservationDate = normalizeText(query.date || query.reservationDate);
  const timeSlot = normalizeText(query.timeSlot || query.slot);
  const guestCount = Number(query.guests || query.guestCount || 1);
  const category = normalizeText(query.category || query.tableCategory);

  if (!reservationDate) {
    throw new Error("Reservation date is required");
  }

  if (!timeSlot) {
    throw new Error("Time slot is required");
  }

  if (!guestCount || guestCount < 1) {
    throw new Error("Guest count must be at least 1");
  }

  const tables = await WebsiteTableReservationModel.getAvailableRestaurantTables({
    reservationDate,
    timeSlot,
    guestCount,
    category,
  });

  return {
    reservationDate,
    timeSlot,
    guestCount,
    category: category || null,
    tables,
  };
}

async function createWebsiteTableReservation(data) {
  await ensureSchema();

  const payload = validateReservationPayload(data);
  const duplicate = await WebsiteTableReservationModel.findDuplicateCandidate(payload);

  if (duplicate) {
    return {
      id: duplicate.id,
      reservationCode: duplicate.reservationCode,
      status: duplicate.status,
      reused: true,
      message: "An active reservation already exists for the same mobile, date, and slot.",
    };
  }

  const availability = await getDiningAvailability({
    reservationDate: payload.reservationDate,
    guestCount: payload.guestCount,
  });
  const slotInfo = availability.slots.find((slot) => slot.timeSlot === payload.timeSlot);

  if (!slotInfo?.available) {
    throw new Error("Selected time slot is currently unavailable");
  }

  const result = await WebsiteTableReservationModel.createReservation({
    ...payload,
    status: "Pending",
  });
  const reservationCode = toReservationCode(result.insertId);
  await WebsiteTableReservationModel.updateReservationCode(result.insertId, reservationCode);

  const reservation = await WebsiteTableReservationModel.getReservationById(result.insertId);

  return {
    id: result.insertId,
    reservationCode,
    status: reservation?.status || "Pending",
    reservation,
    reused: false,
  };
}

async function getWebsiteTableReservationByCode(code) {
  await ensureSchema();
  return WebsiteTableReservationModel.getReservationByCode(normalizeText(code));
}

async function getAllWebsiteTableReservations(filters = {}) {
  await ensureSchema();
  return WebsiteTableReservationModel.getAllReservations(filters);
}

async function confirmWebsiteTableReservation(id, data = {}) {
  await ensureSchema();

  const existing = await WebsiteTableReservationModel.getReservationById(id);
  if (!existing) {
    throw new Error("Reservation not found");
  }

  if (!ACTIVE_SLOT_STATUSES.has(existing.status) && existing.status !== "No Show") {
    await WebsiteTableReservationModel.updateReservationStatus(id, {
      status: "Confirmed",
      confirmedBy: normalizeText(data.confirmedBy || data.approvedBy || "Admin"),
      confirmedAt: new Date(),
      notes: normalizeText(data.notes) || existing.notes,
    });
  } else {
    await WebsiteTableReservationModel.updateReservationStatus(id, {
      status: "Confirmed",
      confirmedBy: normalizeText(data.confirmedBy || data.approvedBy || "Admin"),
      confirmedAt: new Date(),
      notes: normalizeText(data.notes) || existing.notes,
    });
  }

  return WebsiteTableReservationModel.getReservationById(id);
}

async function cancelWebsiteTableReservationByCode(code, data = {}) {
  await ensureSchema();

  const existing = await WebsiteTableReservationModel.getReservationByCode(normalizeText(code));
  if (!existing) {
    throw new Error("Reservation not found");
  }

  await WebsiteTableReservationModel.updateReservationStatus(existing.id, {
    status: "Cancelled",
    cancelledAt: new Date(),
    notes: normalizeText(data.notes || data.reason) || existing.notes,
  });

  return WebsiteTableReservationModel.getReservationById(existing.id);
}

async function cancelWebsiteTableReservationById(id, data = {}) {
  await ensureSchema();

  const existing = await WebsiteTableReservationModel.getReservationById(id);
  if (!existing) {
    throw new Error("Reservation not found");
  }

  await WebsiteTableReservationModel.updateReservationStatus(id, {
    status: "Cancelled",
    cancelledAt: new Date(),
    notes: normalizeText(data.notes || data.reason) || existing.notes,
  });

  return WebsiteTableReservationModel.getReservationById(id);
}

async function assignWebsiteTableReservationTable(id, data = {}) {
  await ensureSchema();

  const existing = await WebsiteTableReservationModel.getReservationById(id);
  if (!existing) {
    throw new Error("Reservation not found");
  }

  if (!data.tableId) {
    throw new Error("Table id is required");
  }

  const table = await WebsiteTableReservationModel.findRestaurantTableById(data.tableId);
  if (!table) {
    throw new Error("Restaurant table not found");
  }

  if (Number(table.seatCount || 0) < Number(existing.guestCount || 0)) {
    throw new Error("Selected table capacity is smaller than guest count");
  }

  await WebsiteTableReservationModel.assignTable(id, {
    assignedTableId: table.id,
    assignedTableNumber: table.number,
    notes: normalizeText(data.notes) || existing.notes,
  });

  return WebsiteTableReservationModel.getReservationById(id);
}

async function seatWebsiteTableReservation(id, data = {}) {
  await ensureSchema();

  const existing = await WebsiteTableReservationModel.getReservationById(id);
  if (!existing) {
    throw new Error("Reservation not found");
  }

  await WebsiteTableReservationModel.updateReservationStatus(id, {
    status: "Seated",
    notes: normalizeText(data.notes) || existing.notes,
  });

  return WebsiteTableReservationModel.getReservationById(id);
}

async function markNoShowWebsiteTableReservation(id, data = {}) {
  await ensureSchema();

  const existing = await WebsiteTableReservationModel.getReservationById(id);
  if (!existing) {
    throw new Error("Reservation not found");
  }

  await WebsiteTableReservationModel.updateReservationStatus(id, {
    status: "No Show",
    notes: normalizeText(data.notes) || existing.notes,
  });

  return WebsiteTableReservationModel.getReservationById(id);
}

const crypto = require("crypto");
const Razorpay = require("razorpay");



const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function getReservationAmount(reservation) {
  const guestCount = Number(reservation?.guestCount || 1);
  return guestCount * 1999;
}
async function createWebsiteTableReservationPaymentOrder(code, data = {}) {
  await ensureSchema();

  const reservation = await WebsiteTableReservationModel.getReservationByCode(normalizeText(code));
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }

  const amount = Number(data.amount || getReservationAmount(reservation));
  if (!amount || amount < 1) {
    throw new Error("Valid payment amount is required");
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: reservation.reservationCode,
    notes: {
      reservationCode: reservation.reservationCode,
      reservationId: String(reservation.id),
    },
  });

  await WebsiteTableReservationModel.updatePaymentOrder(reservation.id, {
    paymentMethod: "online",
    paymentStatus: "Pending",
    paymentAmount: amount,
    razorpayOrderId: order.id,
  });

  return {
    reservationCode: reservation.reservationCode,
    reservationId: reservation.id,
    amount,
    currency: order.currency,
    orderId: order.id,
    key: process.env.RAZORPAY_KEY_ID,
  };
}

async function verifyWebsiteTableReservationPayment(code, data = {}) {
  await ensureSchema();

  const reservation = await WebsiteTableReservationModel.getReservationByCode(normalizeText(code));
  if (!reservation) {
    throw new Error("Reservation not found");
  }

  const razorpayOrderId = normalizeText(data.razorpay_order_id || data.razorpayOrderId);
  const razorpayPaymentId = normalizeText(data.razorpay_payment_id || data.razorpayPaymentId);
  const razorpaySignature = normalizeText(data.razorpay_signature || data.razorpaySignature);

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new Error("Payment verification fields are required");
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (generatedSignature !== razorpaySignature) {
    throw new Error("Invalid payment signature");
  }

  await WebsiteTableReservationModel.markReservationPaymentSuccess(reservation.id, {
    paymentMethod: "online",
    paymentStatus: "Paid",
    razorpayOrderId,
    razorpayPaymentId,
    paidAt: new Date(),
  });

  return WebsiteTableReservationModel.getReservationById(reservation.id);
}










module.exports = {
  ensureSchema,
  getDiningConfig,
  getDiningAvailability,
  getAvailableTables,
  createWebsiteTableReservation,
  getWebsiteTableReservationByCode,
  getAllWebsiteTableReservations,
  confirmWebsiteTableReservation,
  cancelWebsiteTableReservationByCode,
  cancelWebsiteTableReservationById,
  assignWebsiteTableReservationTable,
  seatWebsiteTableReservation,
  markNoShowWebsiteTableReservation,
  createWebsiteTableReservationPaymentOrder,
verifyWebsiteTableReservationPayment,

};
