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
router.post("/logout", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    partitioned: isProd,
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
module.exports = router;
