/**
 * Barrel re-exports for the banquet controller split.
 *
 * Import from here for backward compatibility, or import directly from:
 *   - utils/banquetHelpers.js          (shared DB helpers, meta tokens, overlap checks)
 *   - controller/banquetPricingController.js  (pricing config CRUD)
 *   - controller/banquetBookingsController.js  (booking CRUD + dashboard)
 *   - controller/banquetHallController.js      (hall CRUD)
 */

const pricingController = require("./banquetPricingController");
const bookingsController = require("./banquetBookingsController");
const hallController = require("./banquetHallController");

// Re-export everything from each split controller so existing imports keep working.
module.exports = {
  // Pricing config
  getBanquetPricingConfig: pricingController.getBanquetPricingConfigHandler,
  updateBanquetPricingConfig: pricingController.updateBanquetPricingConfig,

  // Dashboard & bookings
  getBanquetDashboard: bookingsController.getBanquetDashboard,
  createBanquetBooking: bookingsController.createBanquetBooking,
  updateBanquetBooking: bookingsController.updateBanquetBooking,
  cancelBanquetBooking: bookingsController.cancelBanquetBooking,
  refundBanquetBooking: bookingsController.refundBanquetBooking,
  deleteBanquetBooking: bookingsController.deleteBanquetBooking,
  completeBanquetBooking: bookingsController.completeBanquetBooking,
  generateBanquetBill: bookingsController.generateBanquetBill,

  // Halls
  addBanquetHall: hallController.addBanquetHall,
  updateBanquetHall: hallController.updateBanquetHall,
  deleteBanquetHall: hallController.deleteBanquetHall,
};
