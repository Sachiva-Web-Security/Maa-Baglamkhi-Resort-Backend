const express = require("express");
const router = express.Router();

const {
  registerCustomer,
  loginCustomer,
  getMe,
} = require("../controller/websiteAuthController");

// routes
router.post("/auth/register", registerCustomer);
router.post("/auth/login", loginCustomer);
router.get("/auth/me", getMe);

module.exports = router;