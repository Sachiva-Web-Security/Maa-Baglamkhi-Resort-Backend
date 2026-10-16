import axios from "axios";

const ENV =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

// Single base URL for every request.
// Default "/api" keeps the browser same-origin with the dev server, so Vite's
// proxy forwards /api to the backend on 5002 — no CORS, no mixed transport.
const API_BASE =
  ENV.VITE_API_BASE_URL ||
  ENV.VITE_API_BASE ||
  ENV.VITE_API_URL ||
  "/api";

const API = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
  withCredentials: false,
});

const LOGIN_PATH = "/login";

function authCleared() {
  return Boolean(localStorage.getItem("token"));
}

function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
  localStorage.removeItem("email");
  localStorage.removeItem("isAuthenticated");
}

function redirectToListing() {
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(`${window.location.origin}${LOGIN_PATH}`);
  }
}

API.interceptors.request.use((req) => {
  // Bearer token is the one auth transport. Sent on every request, including
  // cross-origin ones, so no call depends on a cookie crossing origins.
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

// 401 handling and transient-retry live in the same interceptor so a 401 never
// gets retried, and a retry never masks a logout.
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    if (status === 401 && !err.config?.skipAuthRedirect) {
      // The login call itself returns 401 on a bad password. Only log the user
      // out when there was a real session before this response.
      if (authCleared()) {
        clearAuthState();
        redirectToListing();
      }
      return Promise.reject(err);
    }

    const isTimeout =
      err.code === "ECONNABORTED" || err.message?.includes("timeout");
    const shouldRetry =
      !err.config?.skipRetry &&
      status !== 401 &&
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

/** Extract a human-readable message from a rejected request. */
export function getErrorMessage(err, fallback = "Something went wrong.") {
  const status = err?.response?.status;
  if (!err) return fallback;
  if (err.response) {
    const data = err.response.data;
    const message =
      (typeof data === "string" && data) ||
      data?.message ||
      data?.error ||
      data?.Message;
    if (message) return String(message);
    if (status === 401) return "Session expired. Please sign in again.";
    if (status === 403) return "You do not have permission to do that.";
    if (status === 404) return "That resource was not found.";
    if (status >= 500) return "The server is having trouble. Please try again.";
    return `Request failed (${status}).`;
  }
  if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
    return "The server took too long to respond.";
  }
  return "Cannot reach the server. Check your connection.";
}

/** Base URL of the backend server (no /api) for building upload URLs. */
export function getBackendBaseURL() {
  const base = API.defaults.baseURL || "";
  if (/^https?:\/\//i.test(base)) {
    return base.replace(/\/api\/?$/, "");
  }
  return window.location.origin;
}

export default API;
