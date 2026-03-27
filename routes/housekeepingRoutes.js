const express = require("express");
const router = express.Router();

const ctrl = require("../controller/housekeepingController");

router.get("/", ctrl.getAllRooms);
router.get("/logs", ctrl.getLogs);
router.post("/", ctrl.createRoom);
router.put("/:id", ctrl.updateRoom);
router.put("/status/:id", ctrl.updateStatus);
router.put("/assignee/:id", ctrl.updateAssignee);
router.delete("/:id", ctrl.deleteRoom);

router.get("/parameters", ctrl.getParameters);
router.post("/parameters", ctrl.saveParameters);

router.post("/message", ctrl.sendMessage);

router.get("/amenities", ctrl.getAmenities);
router.post("/amenities", ctrl.logAmenity);
router.delete("/amenities/:id", ctrl.deleteAmenity);

router.get("/inspections", ctrl.getInspections);
router.post("/inspections", ctrl.createInspection);
router.get("/inspections/:id", ctrl.getInspectionById);

router.get("/lost-found", ctrl.getLostFound);
router.post("/lost-found", ctrl.createLostFound);
router.put("/lost-found/:id", ctrl.updateLostFound);
router.delete("/lost-found/:id", ctrl.deleteLostFound);

router.get("/roster", ctrl.getRoster);
router.post("/roster", ctrl.saveRoster);

router.get("/costing", ctrl.getCostingLogs);
router.post("/costing", ctrl.logCost);

router.get("/checkout-report", ctrl.getCheckoutReport);

router.get("/completed-cleaning", ctrl.getCompletedCleaningLogs);
router.post("/completed-cleaning", ctrl.createCompletedCleaningLog);

module.exports = router;
