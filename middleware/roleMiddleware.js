/**
 * Role-based access middleware. Normalises the comparison to lowercase
 * on both sides so casing drift between tokens and route definitions
 * can't accidentally grant access.
 */
function roleMiddleware(roles) {
  const allowed = (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .map((r) => String(r).toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userRole = String(req.user.role || "").toLowerCase();
    if (!userRole || !allowed.includes(userRole)) {
      return res.status(403).json({ message: "Access denied" });
    }

    return next();
  };
}

module.exports = roleMiddleware;
