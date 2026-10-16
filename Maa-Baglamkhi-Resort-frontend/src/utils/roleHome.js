// Canonical role mapping between the backend and this frontend.
//
// The backend `roles` table stores: admin, manager, reception, accounts,
// housekeeping, waiter, kitchen.
//
// This frontend was written against display names: receptionist, accountant,
// chef, staff. Several role strings here (receptionist, accountant) do not
// exist in the backend table at all, so a role that arrives as "accounts" used
// to fall through every check and land the user on /login.
//
// normalizeRole() collapses both spellings onto one canonical key, and
// hasRole() is what ProtectedRoute and the ROLES lists must use so a guard
// never rejects a user because of a naming difference.

export const ROLE_HOME = {
  admin: "/dashboard",
  manager: "/manager-dashboard",
  receptionist: "/reception-dashboard",
  housekeeping: "/housekeeping-dashboard",
  accountant: "/accounts-dashboard",
  kitchen: "/kitchen-dashboard",
  chef: "/chef-dashboard",
  waiter: "/restaurant-dashboard",
  staff: "/staff-dashboard",
};

export const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  receptionist: "Receptionist",
  housekeeping: "Housekeeping",
  accountant: "Accountant",
  kitchen: "Kitchen",
  chef: "Chef",
  waiter: "Waiter",
  staff: "Staff",
};

// Backend table name -> frontend canonical key.
const ROLE_ALIASES = {
  reception: "receptionist",
  accounts: "accountant",
  account: "accountant",
  accounting: "accountant",
  housekeeper: "housekeeping",
  server: "waiter",
  // "staff" is a generic backend label; map it to the receptionist surface,
  // which is the least-privileged login in this system.
  staff: "staff",
};

export function normalizeRole(role) {
  const base = String(role || "").toLowerCase().trim();
  return ROLE_ALIASES[base] || base;
}

export function getRoleHome(role) {
  return ROLE_HOME[normalizeRole(role)] || "/login";
}

export function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || "User";
}

// True when `role` satisfies an allowed-roles list. Compare after
// normalization so ["admin", "manager", "accountant"] admits a backend role
// of "accounts".
export function hasRole(role, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  const normalized = normalizeRole(role);
  return allowedRoles.some((allowed) => normalizeRole(allowed) === normalized);
}
