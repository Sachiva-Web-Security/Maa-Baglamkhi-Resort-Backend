const express = require("express");
const router = express.Router();

const housekeepingController = require("../controller/housekeepingController");


router.get("/", housekeepingController.getAllRooms);

router.post("/", housekeepingController.createRoom);

router.put("/status/:id", housekeepingController.updateStatus);

router.put("/assignee/:id", housekeepingController.updateAssignee);

router.delete("/:id", housekeepingController.deleteRoom);


module.exports = router;