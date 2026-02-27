const router = require("express").Router();
const { summary } = require("../controller/reportsController");

router.get("/summary", summary);

module.exports = router;

