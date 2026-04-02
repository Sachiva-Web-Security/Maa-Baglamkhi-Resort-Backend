const router = require("express").Router();
const { login, register } = require("../controller/authController");
const { authRateLimiter } = require("../config/security");

router.post("/login", authRateLimiter, login);
router.post("/register", authRateLimiter, register);

module.exports = router;
