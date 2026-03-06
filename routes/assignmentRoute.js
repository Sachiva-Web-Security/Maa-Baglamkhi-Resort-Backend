const express = require("express");
const router = express.Router();
const controller = require("../controller/assignmentController");

// Special routes first (before /:id so "stats" and "edit" are not captured as id)
router.get("/stats", controller.getStats);
router.put("/edit/:id", controller.editAssignment);

router.post("/", controller.createAssignment);
router.get("/", controller.getAssignments);
router.put("/:id", controller.updateAssignment);
router.delete("/:id", controller.deleteAssignment);

module.exports = router;