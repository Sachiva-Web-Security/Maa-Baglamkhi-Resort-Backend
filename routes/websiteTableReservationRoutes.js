const express = require("express");
const controller = require("../controller/websiteTableReservationController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const router = express.Router();

router.get("/config", controller.getDiningConfig);
router.get("/availability", controller.getDiningAvailability);
router.get("/available-tables", controller.getAvailableTables);
router.post("/reservations/:code/payment/order", controller.createWebsiteTableReservationPaymentOrder);
router.post("/reservations/:code/payment/verify", controller.verifyWebsiteTableReservationPayment);

router.post("/reservations", controller.createWebsiteTableReservation);
router.get("/reservations/:code", authMiddleware, controller.getWebsiteTableReservationByCode);
router.patch("/reservations/:code/cancel", authMiddleware, controller.cancelWebsiteTableReservationByCode);

router.get("/admin/reservations", authMiddleware, roleMiddleware(["admin"]), controller.getAllWebsiteTableReservations);

router.patch("/admin/reservations/:id/confirm", authMiddleware, roleMiddleware(["admin"]), controller.confirmWebsiteTableReservation);

router.patch("/admin/reservations/:id/cancel", authMiddleware, roleMiddleware(["admin"]), controller.cancelWebsiteTableReservationById);

router.patch("/admin/reservations/:id/assign-table", authMiddleware, roleMiddleware(["admin"]), controller.assignWebsiteTableReservationTable);

router.patch("/admin/reservations/:id/seat", authMiddleware, roleMiddleware(["admin"]), controller.seatWebsiteTableReservation);

router.patch("/admin/reservations/:id/no-show", authMiddleware, roleMiddleware(["admin"]), controller.markNoShowWebsiteTableReservation);

module.exports = router;
