const express = require("express");
const router = express.Router();
const ctrl = require("../controller/assignmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "receptionist", "housekeeping", "accountant", "staff"];
const MANAGERS = ["admin", "manager", "receptionist"];
const ASSIGNEES = ["housekeeping", "accountant", "staff"];

if (typeof ctrl.bootstrap === "function") {
  router.use(ctrl.bootstrap);
}
router.use(authMiddleware);

router.get("/stats", roleMiddleware(READERS), ctrl.getStats);
router.get("/", roleMiddleware(READERS), ctrl.getAll);
router.post("/", roleMiddleware(MANAGERS), ctrl.create);
router.put("/:id", roleMiddleware(MANAGERS), ctrl.update);
router.patch(
  "/:id/status",
  roleMiddleware([...MANAGERS, ...ASSIGNEES]),
  typeof ctrl.updateStatus === "function" ? ctrl.updateStatus : ctrl.update,
);
router.delete("/:id", roleMiddleware(MANAGERS), ctrl.remove);

module.exports = router;
