const router = require("express").Router();
const { summary, getReportData } = require("../controller/reportsController");

router.get("/summary", summary);
router.get("/data", getReportData);

module.exports = router;

