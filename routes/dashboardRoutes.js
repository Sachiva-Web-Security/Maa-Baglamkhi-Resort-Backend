const router = require("express").Router();
const {
    getMetrics,
    getCharts,
} = require("../controller/dashboardController");

router.get("/metrics", getMetrics);
router.get("/charts", getCharts);

module.exports = router;
