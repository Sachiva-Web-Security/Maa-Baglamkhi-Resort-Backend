const express = require("express");
const router = express.Router();

const housekeepingController = require("../controller/housekeepingController");

router.get("/", housekeepingController.getAllRooms);
router.get("/logs", housekeepingController.getLogs);
router.post("/", housekeepingController.createRoom);
router.put("/:id", housekeepingController.updateRoom);
router.put("/status/:id", housekeepingController.updateStatus);
router.put("/assignee/:id", housekeepingController.updateAssignee);
router.delete("/:id", housekeepingController.deleteRoom);

module.exports = router;

const ctrl = require("../controller/housekeepingController");

// =============================================
// EXISTING ROUTES
// =============================================
router.get("/",                 ctrl.getAllRooms);
router.post("/",                ctrl.createRoom);
router.put("/status/:id",       ctrl.updateStatus);
router.put("/assignee/:id",     ctrl.updateAssignee);
router.delete("/:id",           ctrl.deleteRoom);

// =============================================
// PARAMETERS
// =============================================
router.get("/parameters",       ctrl.getParameters);
router.post("/parameters",      ctrl.saveParameters);

// =============================================
// MESSAGES (cleaning notes to reception)
// =============================================
router.post("/message",         ctrl.sendMessage);

// =============================================
// AMENITIES CONSUMPTION
// =============================================
router.get("/amenities",        ctrl.getAmenities);
router.post("/amenities",       ctrl.logAmenity);
router.delete("/amenities/:id", ctrl.deleteAmenity);

// =============================================
// ROOM INSPECTION CHECKLIST
// =============================================
router.get("/inspections",      ctrl.getInspections);
router.post("/inspections",     ctrl.createInspection);
router.get("/inspections/:id",  ctrl.getInspectionById);

// =============================================
// LOST & FOUND
// =============================================
router.get("/lost-found",        ctrl.getLostFound);
router.post("/lost-found",       ctrl.createLostFound);
router.put("/lost-found/:id",    ctrl.updateLostFound);
router.delete("/lost-found/:id", ctrl.deleteLostFound);

// =============================================
// SHIFT / DUTY ROSTER
// =============================================
router.get("/roster",            ctrl.getRoster);
router.post("/roster",           ctrl.saveRoster);

// =============================================
// ROOM COSTING
// =============================================
router.get("/costing",           ctrl.getCostingLogs);
router.post("/costing",          ctrl.logCost);

// =============================================
// CHECKOUT REPORT
// =============================================
router.get("/checkout-report",   ctrl.getCheckoutReport);

module.exports = router;
