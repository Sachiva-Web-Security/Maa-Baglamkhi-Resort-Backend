// ── Role alias resolution ──────────────────────────────────────────────────
//
// Three spellings of the same role exist across this codebase:
//
//   role_id    roles.name  route lists / frontend      this file maps all
//   "1"        "admin"     "admin"                     to ONE canonical key
//   "2"        "manager"   "manager"
//   "3"        "reception" "receptionist"
//   "4"        "accounts"  "accountant"
//   "5"        "housekeeping" "housekeeping"
//   "6"        "waiter"    "waiter"
//   "7"        "kitchen"   "kitchen" | "chef"
//
// Routes were written against the frontend display names (receptionist,
// accountant, chef, staff) while the JWT carries the roles.name column
// (reception, accounts, ...). Before this alias map existed, every route that
// named "receptionist" or "accountant" denied access with 403 even though the
// user was authorised.
//
// normalizeRole() is applied to BOTH the incoming JWT role and the route's
// allowed-list, so a route may spell the name either way.

const ROLE_ALIASES = {
  // numeric role_id -> canonical
  "1": "admin",
  "2": "manager",
  "3": "reception",
  "4": "accounts",
  "5": "housekeeping",
  "6": "waiter",
  "7": "kitchen",

  // frontend display names -> canonical
  administrator: "admin",
  receptionist: "reception",
  frontdesk: "reception",
  reception_desk: "reception",
  accountant: "accounts",
  accounting: "accounts",
  housekeeper: "housekeeping",
  server: "waiter",
  chef: "kitchen",

  // "staff" is a generic frontend label. Keep it distinct from any real role
  // so a guard that lists "staff" does not accidentally grant manager access.
  staff: "staff",
};

function normalizeRole(raw) {
  const base = String(raw == null ? "" : raw).trim().toLowerCase();
  return ROLE_ALIASES[base] || base;
}

function roleMiddleware(roles) {
  const allowed = (roles || []).map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "User not authenticated",
      });
    }

    const normalized = normalizeRole(req.user.role);

    if (!allowed.includes(normalized)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    next();
  };
}

module.exports = roleMiddleware;
module.exports.normalizeRole = normalizeRole;
