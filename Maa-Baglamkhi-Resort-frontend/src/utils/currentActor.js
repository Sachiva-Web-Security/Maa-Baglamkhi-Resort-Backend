import { normalizeRole } from "./roleHome";

export const normalizeActorName = (value) => String(value || "").trim().toLowerCase();
// Keep the export name for existing callers, but resolve aliases so the
// backend's "reception"/"accounts" land on the frontend's canonical keys.
export const normalizeActorRole = (value) => normalizeRole(value);

export const getCurrentActor = () => {
  const name = String(localStorage.getItem("name") || "").trim();
  const role = normalizeActorRole(localStorage.getItem("role"));

  return {
    name,
    role,
    normalizedName: normalizeActorName(name),
    isWaiter: role === "waiter",
    isManager: role === "manager",
    isAdmin: role === "admin",
    isReceptionist: role === "receptionist",
    isAccountant: role === "accountant",
    isHousekeeping: role === "housekeeping",
    isKitchen: role === "kitchen",
    isChef: role === "chef",
  };
};

export const namesMatch = (left, right) => {
  const normalizedLeft = normalizeActorName(left);
  const normalizedRight = normalizeActorName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight;
};
