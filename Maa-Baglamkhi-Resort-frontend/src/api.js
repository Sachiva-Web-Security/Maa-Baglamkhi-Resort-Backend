import axios from "axios";

const ENV =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : {};

const API = axios.create({
  baseURL: ENV.VITE_API_BASE || ENV.VITE_API_URL || ENV.VITE_BACKEND_ORIGIN || "http://localhost:5002/api",
  timeout: 15_000,
  withCredentials: true,
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  const method = String(req.method || "get").toLowerCase();
  const inferredAction =
    req.auditAction ||
    (req.url?.includes("/login")
      ? "login"
      : method === "delete"
      ? "delete"
      : method === "put" || method === "patch"
      ? "update"
      : method === "post"
      ? "create"
      : "read");

  req.headers["X-Audit-Action"] = inferredAction;
  req.headers["X-Audit-Source"] = "frontend";
  req.headers["X-Audit-User-Email"] = localStorage.getItem("email") || null;

  return req;
});

// Retry on transient backend-down errors (ECONNREFUSED / proxy 502/503/504)
// Also handle 401 in the same interceptor so both behaviors run together
API.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401: clear auth state
    if (err.response?.status === 401 && !err.config?.skipAuthRedirect) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      localStorage.removeItem("email");
      localStorage.removeItem("isAuthenticated");

      if (window.location.pathname !== "/login") {
        window.location.assign(`${window.location.origin}/login`);
      }
    }

    const isTimeout = err.code === "ECONNABORTED" || err.message?.includes("timeout");
    const shouldRetry =
      !err.config?.skipRetry &&
      err.response?.status !== 401 &&
      (err.code === "ERR_NETWORK" ||
        err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("ECONNRESET") ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("socket hang up") ||
        isTimeout);

    if (!shouldRetry || err.config?.__retryCount >= 3) {
      return Promise.reject(err);
    }

    const delay = [500, 1500, 3000][Math.min(err.config.__retryCount || 0, 2)];
    err.config.__retryCount = (err.config.__retryCount || 0) + 1;

    return new Promise((resolve) => {
      setTimeout(() => resolve(API.request(err.config)), delay);
    });
  }
);

/** Base URL of the backend server (no /api) for building upload URLs */
export function getBackendBaseURL() {
  const base = API.defaults.baseURL || "";
  return base.replace(/\/api\/?$/, "") || window.location.origin;
}

export default API;
