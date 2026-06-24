const router = require("express").Router();
const { login, register, logout, me, refresh } = require("../controller/authController");
const { authRateLimiter } = require("../config/security");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/login", authRateLimiter, login);
router.post("/register", authRateLimiter, register);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, me);
router.post("/refresh", authMiddleware, refresh);

module.exports = router;
