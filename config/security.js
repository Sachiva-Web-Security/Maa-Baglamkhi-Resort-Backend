const rateLimit = require("express-rate-limit");

const DEFAULT_DEV_ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
];

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const configuredOrigins = parseAllowedOrigins(
    process.env.CORS_ORIGINS || process.env.CORS_ORIGIN,
  );

  if (configuredOrigins.length) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return DEFAULT_DEV_ALLOWED_ORIGINS;
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);
    const hostname = String(url.hostname || "").toLowerCase();

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
  } catch {
    return false;
  }
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (!allowedOrigins.length) {
    return isLocalDevelopmentOrigin(origin);
  }

  return process.env.NODE_ENV !== "production" && isLocalDevelopmentOrigin(origin);
}

function createCorsOriginHandler() {
  const allowedOrigins = getAllowedOrigins();

  return (origin, callback) => {
    return callback(null, isOriginAllowed(origin, allowedOrigins));
  };
}

function getCorsOptions() {
  return {
    origin: createCorsOriginHandler(),
    credentials: true,
    optionsSuccessStatus: 204,
  };
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || "").trim();

  if (!secret) {
    throw new Error("JWT_SECRET must be set in the environment.");
  }

  return secret;
}

function isLocalRequest(req) {
  const origin = String(req.get("origin") || "").trim();
  const host = String(req.get("host") || "").trim().toLowerCase();
  const forwardedFor = String(req.ip || "").trim().toLowerCase();

  return (
    isLocalDevelopmentOrigin(origin) ||
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    forwardedFor === "::1" ||
    forwardedFor === "::ffff:127.0.0.1" ||
    forwardedFor === "127.0.0.1"
  );
}

const authRateLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) =>
    process.env.NODE_ENV === "test" ||
    String(process.env.AUTH_RATE_LIMIT_DISABLED || "").toLowerCase() === "true" ||
    isLocalRequest(req),
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
});

module.exports = {
  authRateLimiter,
  getAllowedOrigins,
  getCorsOptions,
  getJwtSecret,
};
