const express = require("express");
const router = express.Router();

const controller = require("../controller/paymentController");

router.post("/", controller.createPayment);
router.get("/", controller.getPayments);

module.exports = router;