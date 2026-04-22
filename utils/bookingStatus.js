const BOOKING_STATUS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
};

const PAYMENT_STATUS = {
  PENDING: "pending",
  CREATED: "created",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
};

module.exports = { BOOKING_STATUS, PAYMENT_STATUS };
