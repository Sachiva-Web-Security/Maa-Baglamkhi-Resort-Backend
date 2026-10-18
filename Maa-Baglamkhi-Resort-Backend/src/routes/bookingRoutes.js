const express = require("express");
const router = express.Router();
const upload = require("../utils/upload");

const bookingController = require("../controller/bookingController");
const hotelRoomInventoryController = require("../controller/hotelRoomInventoryController");
const folioController        = require("../controller/folioController");
const roomBlockController    = require("../controller/roomBlockController");
const guestDocumentController = require("../controller/guestDocumentController");
const guestProfileController = require("../controller/guestProfileController");
const groupBookingController = require("../controller/groupBookingController");
const whatsappInvoiceController = require("../controller/whatsappInvoiceController");
const guestController = require("../controller/guestController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(hotelRoomInventoryController.bootstrap);

// Protect the whole hotel/booking surface. These routes mutate booking state,
// room inventory and guest data, so they must not be reachable unauthenticated.
router.use(authMiddleware);

// CREATE
router.post("/guest", bookingController.createGuest);
router.post("/other-booking/:id", bookingController.updateOtherBooking);
router.post("/reference/:id", bookingController.updateReference);
router.post("/company/:id", bookingController.updateCompany);
router.post("/pax/:id", bookingController.updatePax);
router.post("/room-tariff/:id", bookingController.updateTariff);
router.post("/advance/:id", bookingController.updateAdvance);

// GET
router.get("/all-bookings", bookingController.getAllBookings);
// Collection aliases for the frontend's mount-root and section calls.
router.get("/", bookingController.getAllBookings);
router.get("/payment-history", bookingController.getAllBookings);
router.get("/room-tariff", bookingController.getBookingHistory);
router.get("/communication", bookingController.getBookingHistory);
router.get("/booking/:id", bookingController.getBookingById);
router.get("/wizard/:id", bookingController.getBookingWizard);
router.get("/rooms/setup", hotelRoomInventoryController.getRoomSetup);
router.get("/rooms", hotelRoomInventoryController.getRoomSetup);
router.get("/rooms-availability", hotelRoomInventoryController.getRoomSetup);

// UPDATE
router.put("/booking/:id", bookingController.updateBooking);
router.put("/full-booking/:id", bookingController.updateFullBooking);
router.put("/check-in/:id", bookingController.checkInBooking);
router.put("/check-out/:id", bookingController.checkOutBooking);
router.put("/cancel/:id", bookingController.cancelBooking);
router.put("/rooms/category/:id/price", hotelRoomInventoryController.updateCategoryPrice);
router.put("/rooms/state/:roomNumber", hotelRoomInventoryController.updateRoomOperationalState);

// Room availability validation (date overlap check)
router.post("/rooms/validate-availability", hotelRoomInventoryController.validateRoomAvailability);

// FULL GET
router.get("/full-booking/:id", bookingController.getFullBooking);
router.get("/booking-history", bookingController.getBookingHistory);

// DELETE room from inventory
router.delete("/rooms/:roomNumber", hotelRoomInventoryController.deleteRoom);

// DELETE + REFUND
router.post("/rooms", hotelRoomInventoryController.addRoom);

router.post("/refund/:id", bookingController.refundBooking);

router.get("/payment-history/:id", bookingController.getPaymentHistory);

// Guest Folio / Night Audit
router.get("/folio/:bookingId",        folioController.getByBooking);
router.post("/folio/:bookingId",       folioController.addEntry);
router.delete("/folio/entry/:entryId", folioController.deleteEntry);
router.get("/folio/:bookingId/totals", folioController.getTotals);

// Room Blocking / Maintenance
// ─── Room Blocks (role-protected) ─────────────────────────────────────────────
const roomBlockRouter = express.Router();
roomBlockRouter.use(authMiddleware);
roomBlockRouter.get("/", roleMiddleware(["admin","manager","receptionist","housekeeping","accountant","staff"]), roomBlockController.getAll);
roomBlockRouter.post("/", roleMiddleware(["admin","manager","receptionist"]), roomBlockController.create);
roomBlockRouter.put("/:id", roleMiddleware(["admin","manager","receptionist","housekeeping","accountant","staff"]), roomBlockController.updateStatus);
router.use("/room-blocks", roomBlockRouter);
router.use("/room-block", roomBlockRouter);

// Guest Profile / History
router.get("/guest-profile",           guestProfileController.search);
router.get("/guests/search",           guestProfileController.searchList);
router.get("/guest-documents/:bookingId", guestDocumentController.listByBooking);
router.post("/guest-documents/:bookingId", upload.single("document"), guestDocumentController.uploadByBooking);
router.delete("/guest-documents/:bookingId/:documentId", guestDocumentController.deleteByBooking);

// Admin-only guest phone update. Must be mounted at the full path: a
// router.use("/guest", ...) here makes POST /hotel/guest (create booking)
// fall through into the empty sub-router and 404.
const guestAdminRouter = express.Router();
guestAdminRouter.use(authMiddleware);
guestAdminRouter.use(roleMiddleware(["admin"]));
guestAdminRouter.put("/guest/phone/:bookingId", guestController.updateGuestPhone);
router.use(guestAdminRouter);

// Hotel Invoice PDF → WhatsApp
router.post("/invoice/pdf", whatsappInvoiceController.sendInvoiceWhatsApp);

// Group Booking
router.post("/group-booking",          groupBookingController.create);

// Notifications
router.post("/notify/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    res.json({ message: "Notification sent", bookingId });
  } catch (err) {
    res.status(500).json({ message: "Failed to send notification", error: err.message });
  }
});

module.exports = router;

