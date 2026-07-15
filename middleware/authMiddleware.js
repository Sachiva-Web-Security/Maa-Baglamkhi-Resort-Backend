const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/security");

const JWT_SECRET = getJwtSecret();

function authMiddleware(req, res, next) {
  // 1. Try Authorization header first (Bearer token)
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
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
      const decoded = jwt.verify(cookieToken, JWT_SECRET);
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
