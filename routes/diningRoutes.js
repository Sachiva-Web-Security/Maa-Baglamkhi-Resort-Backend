const express = require("express");
const router = express.Router();
const diningController = require("../controller/diningController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

/* ─── Public (no auth required) ─────────────────────────────────────────── */

router.get("/config", diningController.getDiningConfig);
router.get("/availability", diningController.getDiningAvailability);
router.post("/reservations", diningController.createReservation);
router.get("/reservations/:code", diningController.getReservationByCode);
router.patch("/reservations/:code/cancel", diningController.cancelReservation);

/* ─── Admin (auth required) ─────────────────────────────────────────────── */

const adminRouter = express.Router();
adminRouter.use(authMiddleware);
adminRouter.use(roleMiddleware(["admin", "manager", "receptionist"]));

adminRouter.get("/admin/reservations", diningController.getAdminReservations);
adminRouter.patch("/admin/reservations/:id/confirm", diningController.confirmReservation);
adminRouter.patch("/admin/reservations/:id/assign-table", diningController.assignTable);
adminRouter.patch("/admin/reservations/:id/seat", diningController.markSeated);
adminRouter.patch("/admin/reservations/:id/no-show", diningController.markNoShow);

router.use("/", adminRouter);

module.exports = router;
