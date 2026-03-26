const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getAuditLogs } = require("../controller/auditLogController");

router.get("/", authMiddleware, roleMiddleware(["admin", "manager"]), getAuditLogs);

module.exports = router;
