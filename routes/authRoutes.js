const router = require("express").Router();
const { login, register } = require("../controller/authController");
const { authRateLimiter } = require("../config/security");

router.post("/login", authRateLimiter, login);
router.post("/register", authRateLimiter, register);

// Returns the authenticated user's info using httpOnly cookie token
router.get("/me", require("../middleware/authMiddleware"), (req, res) => {
  const user = req.user || {};
  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: String(user.role || "").toLowerCase(),
  });
});

module.exports = router;
