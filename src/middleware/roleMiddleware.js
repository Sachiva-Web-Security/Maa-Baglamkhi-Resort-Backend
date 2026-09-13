const ROLE_ALIASES = {
  "1": "admin",
  "2": "manager",
  "3": "reception",
  "4": "accounts",
  "5": "housekeeping",
  "6": "waiter",
  "7": "kitchen",
};

function roleMiddleware(roles) {
  const allowed = roles.map((r) => String(r).toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "User not authenticated",
      });
    }

    const rawRole = String(req.user.role || "").trim();
    const normalized = ROLE_ALIASES[rawRole] || rawRole.toLowerCase();

    const hasRole = allowed.includes(normalized);
    if (!hasRole) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    next();
  };
}

module.exports = roleMiddleware;