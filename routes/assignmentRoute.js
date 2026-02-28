const express = require("express");
const router = express.Router();
const controller = require("../controller/assignmentController");

router.post("/", controller.createAssignment);
router.get("/", controller.getAssignments);
router.put("/:id", controller.updateAssignment);
router.delete("/:id", controller.deleteAssignment);

// special routes first
router.put("/edit/:id", controller.editAssignment);
router.get("/stats", controller.getStats);
module.exports = router;