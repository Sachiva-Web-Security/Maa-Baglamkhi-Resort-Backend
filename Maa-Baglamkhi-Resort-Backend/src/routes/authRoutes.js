const router = require("express").Router();
const { login, register } = require("../controller/authController");
const { authRateLimiter } = require("../config/security");

const authMiddleware = require("../middleware/authMiddleware");

router.post("/login", authRateLimiter, login);
router.post("/register", authRateLimiter, register);

// Everything else on this router needs a valid token.
router.use(authMiddleware);

router.get("/me", (req, res) => {
  const user = req.user || {};
  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: String(user.role || "").toLowerCase(),
  });
});

module.exports = router;
