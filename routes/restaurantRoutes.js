const router = require("express").Router();
const { createBill } = require("../controller/restaurantController");

router.post("/bill", createBill);

module.exports = router;

