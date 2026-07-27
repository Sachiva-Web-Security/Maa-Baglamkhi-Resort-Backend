const express = require("express");
const router = express.Router();
const printController = require("../controller/printController");

router.post("/queue", printController.queuePrint);
router.post("/reprint", printController.reprint);
router.get("/history", printController.getHistory);
router.get("/status", printController.getPrinterStatus);
router.get("/queue", printController.getQueueStatus);
router.delete("/queue/:jobId", printController.cancelQueueJob);
router.get("/types", printController.getPrintTypes);
router.post("/test", printController.testPrint);

module.exports = router;
