const bookingService = require("../services/webBookingService");

exports.bookRoomFromWebsite = async (req, res) => {
  try {
    const result = await bookingService.createWebsiteBooking(req.body);
    res.json({ success: true, message: "Booking successful", ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getWebsiteBookingById = async (req, res) => {
  try {
    const booking = await bookingService.getWebsiteBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllWebsiteBookings = async (_req, res) => {
  try {
    const bookings = await bookingService.getAllWebsiteBookings();
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.confirmWebsiteBooking = async (req, res) => {
  try {
    const booking = await bookingService.confirmWebsiteBooking(req.params.id);
    res.json({ success: true, message: "Booking confirmed", booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelWebsiteBooking = async (req, res) => {
  try {
    await bookingService.cancelWebsiteBooking(req.params.id);
    res.json({ success: true, message: "Booking cancelled" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
