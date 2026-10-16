// Small helper to read the logged-in user's info out of localStorage.
// Login.jsx / the /auth/me check only persist token, role, name, and email —
// there is no numeric user id kept client-side, so `id` is best-effort only
// (falls back to null, which downstream code already handles).
export function getUserFromStorage() {
  if (typeof window === "undefined") return {};
  try {
    return {
      id: localStorage.getItem("userId") || null,
      username: localStorage.getItem("name") || "",
      name: localStorage.getItem("name") || "",
      fullName: localStorage.getItem("name") || "",
      role: (localStorage.getItem("role") || "").toLowerCase(),
      email: localStorage.getItem("email") || "",
    };
  } catch {
    return {};
  }
}

export default getUserFromStorage;