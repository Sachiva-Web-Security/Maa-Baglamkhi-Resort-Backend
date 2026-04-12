const normalizeRole = (value) => String(value || "").trim().toLowerCase();
const normalizeName = (value) => String(value || "").trim().toLowerCase();

const getRequestActor = (req) => {
  const authUser = req?.user || {};
  const headerRole = req?.headers?.["x-user-role"];
  const headerName = req?.headers?.["x-user-name"];
  const resolvedName = String(authUser.name || headerName || "").trim();

  return {
    id: authUser.id || null,
    email: authUser.email || null,
    role: normalizeRole(authUser.role || headerRole),
    name: resolvedName,
    normalizedName: normalizeName(resolvedName),
  };
};

const isWaiterActor = (actor) => normalizeRole(actor?.role) === "waiter";

const namesMatch = (left, right) => {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight;
};

module.exports = {
  getRequestActor,
  isWaiterActor,
  namesMatch,
  normalizeRole,
  normalizeName,
};
