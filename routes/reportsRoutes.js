const router = require("express").Router();
const { summary, getReportData } = require("../controller/reportsController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const REPORT_READERS = ["admin", "manager", "accountant"];

router.use(authMiddleware);
router.use(roleMiddleware(REPORT_READERS));

router.get("/summary", summary);
router.get("/data", getReportData);

module.exports = router;
