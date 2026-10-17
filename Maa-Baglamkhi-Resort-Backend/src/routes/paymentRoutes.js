const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const controller = require("../controller/paymentController");

// Payment creation and listing.
router.use(authMiddleware);

router.post("/", controller.createPayment);
router.get("/", controller.getPayments);

module.exports = router;