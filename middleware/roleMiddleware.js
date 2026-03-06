/**
 * Require req.user.role to be one of allowedRoles.
 * Use after authMiddleware. Sends 403 if role not allowed.
 * @param {string[]} allowedRoles - e.g. ["admin", "manager", "receptionist"]
 */
function roleMiddleware(allowedRoles) {
  const normalized = (allowedRoles || []).map((r) => String(r).toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const userRole = (req.user.role || "").toLowerCase();
    if (!normalized.includes(userRole)) {
      return res.status(403).json({ message: "Access denied. Insufficient role." });
    }

    next();
  };
}

module.exports = roleMiddleware;
