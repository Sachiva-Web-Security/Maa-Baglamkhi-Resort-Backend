const express = require("express");
const router = express.Router();

const ctrl = require("../controller/housekeepingController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "housekeeping", "receptionist", "kitchen", "waiter"];
const EDITORS = ["admin", "manager", "housekeeping", "receptionist"];
const PARAMETER_EDITORS = ["admin", "manager"];

router.use(ctrl.bootstrap);
router.use(authMiddleware);

router.get("/", roleMiddleware(READERS), ctrl.getAllRooms);
router.get("/logs", roleMiddleware(READERS), ctrl.getLogs);
router.get("/notifications", roleMiddleware(READERS), ctrl.getNotifications);
router.post("/", roleMiddleware(EDITORS), ctrl.createRoom);
router.put("/:id", roleMiddleware(EDITORS), ctrl.updateRoom);
router.put("/status/:id", roleMiddleware(EDITORS), ctrl.updateStatus);
router.put("/assignee/:id", roleMiddleware(EDITORS), ctrl.updateAssignee);
router.delete("/:id", roleMiddleware(EDITORS), ctrl.deleteRoom);

router.get("/parameters", roleMiddleware(READERS), ctrl.getParameters);
router.post("/parameters", roleMiddleware(PARAMETER_EDITORS), ctrl.saveParameters);

router.post("/message", roleMiddleware(EDITORS), ctrl.sendMessage);
router.put("/notifications/:id/complete", roleMiddleware(["admin", "manager", "housekeeping"]), ctrl.completeNotification);

router.get("/amenities", roleMiddleware(READERS), ctrl.getAmenities);
router.post("/amenities", roleMiddleware(EDITORS), ctrl.logAmenity);
router.delete("/amenities/:id", roleMiddleware(EDITORS), ctrl.deleteAmenity);

router.get("/inspections", roleMiddleware(READERS), ctrl.getInspections);
router.post("/inspections", roleMiddleware(EDITORS), ctrl.createInspection);
router.get("/inspections/:id", roleMiddleware(READERS), ctrl.getInspectionById);

router.get("/lost-found", roleMiddleware(READERS), ctrl.getLostFound);
router.post("/lost-found", roleMiddleware(EDITORS), ctrl.createLostFound);
router.put("/lost-found/:id", roleMiddleware(EDITORS), ctrl.updateLostFound);
router.delete("/lost-found/:id", roleMiddleware(EDITORS), ctrl.deleteLostFound);

router.get("/roster", roleMiddleware(READERS), ctrl.getRoster);
router.post("/roster", roleMiddleware(PARAMETER_EDITORS), ctrl.saveRoster);

router.get("/costing", roleMiddleware(READERS), ctrl.getCostingLogs);
router.post("/costing", roleMiddleware(EDITORS), ctrl.logCost);

router.get("/checkout-report", roleMiddleware(READERS), ctrl.getCheckoutReport);

router.get("/completed-cleaning", roleMiddleware(READERS), ctrl.getCompletedCleaningLogs);
router.post("/completed-cleaning", roleMiddleware(EDITORS), ctrl.createCompletedCleaningLog);

module.exports = router;


