const jwt = require("jsonwebtoken");
const { getJwtSecret, AUTH_COOKIE_NAME } = require("../config/security");

const JWT_SECRET = getJwtSecret();

/**
 * Authentication middleware.
 *
 * Reads the JWT from one of two sources (in order):
 *   1. `req.cookies.auth_token` — the httpOnly cookie set on login.
 *   2. `Authorization: Bearer <token>` — for non-browser clients and
 *      the existing test suite.
 *
 * Either source failing yields a 401.
 */
function authMiddleware(req, res, next) {
  const token =
    (req.cookies && req.cookies[AUTH_COOKIE_NAME]) ||
    (() => {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) return null;
      return header.split(" ")[1] || null;
    })();

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && typeof decoded.role === "string") {
      decoded.role = decoded.role.toLowerCase();
    }
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = authMiddleware;
