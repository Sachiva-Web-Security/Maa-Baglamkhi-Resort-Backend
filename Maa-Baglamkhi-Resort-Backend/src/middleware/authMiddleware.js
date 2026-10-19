const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/security");

// The secret is read on every request instead of once at module load, so a
// .env change or a different startup environment cannot leave login and
// verification signing with two different keys.

function authMiddleware(req, res, next) {
  // 1. Try Authorization header first (Bearer token)
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      req.user = decoded;
      return next();
    } catch (err) {
      // fall through to cookie check
    }
  }

  // 2. Fallback to httpOnly cookie
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    try {
      const decoded = jwt.verify(cookieToken, getJwtSecret());
      req.user = decoded;
      return next();
    } catch (err) {
      // fall through to 401
    }
  }

  return res.status(401).json({
    message: "No token provided"
  });
}

module.exports = authMiddleware;
