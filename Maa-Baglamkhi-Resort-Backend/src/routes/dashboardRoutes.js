const router = require("express").Router();
const {
    getMetrics,
    getCharts,
} = require("../controller/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Revenue, room occupancy and guest arrivals. Dashboard.jsx is admin-only,
// ManagerDashboard/AccountsDashboard are served to manager and accountant; the
// live stayover and housekeeping views share these same endpoints.
const READERS = ["admin", "manager", "accountant", "reception", "housekeeping"];

router.use(authMiddleware);
router.use(roleMiddleware(READERS));

router.get("/", getMetrics);
router.get("/metrics", getMetrics);
router.get("/charts", getCharts);

module.exports = router;
