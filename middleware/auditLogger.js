const AuditLogModel = require("../models/AuditLogModel");

const SENSITIVE_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "authorization",
  "refreshToken",
]);

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function maskSensitive(value) {
  if (Array.isArray(value)) {
    return value.map(maskSensitive);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, currentValue]) => {
    acc[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : maskSensitive(currentValue);
    return acc;
  }, {});
}

function inferAction(req) {
  const explicitAction = req.headers["x-audit-action"];
  if (explicitAction) return String(explicitAction).trim().toLowerCase();

  const method = String(req.method || "GET").toUpperCase();
  if (method === "POST") return "create";
  if (method === "PUT" || method === "PATCH") return "update";
  if (method === "DELETE") return "delete";
  if (req.path?.includes("login")) return "login";
  return "read";
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null
  );
}

function shouldSkip(req) {
  if (!req.originalUrl) return true;
  return req.originalUrl.startsWith("/uploads") || req.originalUrl === "/api/health";
}

const getPendingAuditLogSet = () => {
  if (!global.__PENDING_AUDIT_LOG_WRITES__) {
    global.__PENDING_AUDIT_LOG_WRITES__ = new Set();
  }
  return global.__PENDING_AUDIT_LOG_WRITES__;
};

async function waitForPendingAuditLogs() {
  const pending = Array.from(getPendingAuditLogSet());
  if (!pending.length) return;
  await Promise.allSettled(pending);
}

function auditLogger(req, res, next) {
  if (shouldSkip(req)) return next();

  req.auditContext = {
    action: inferAction(req),
    userId: null,
    oldValue: null,
    newValue: null,
  };

  req.setAuditContext = (updates = {}) => {
    req.auditContext = {
      ...req.auditContext,
      ...updates,
    };
  };

  let responseBody;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.send = (body) => {
    responseBody = body;
    return originalSend(body);
  };

  res.on("finish", async () => {
    const writePromise = (async () => {
      await AuditLogModel.createLog({
        userId:
          req.auditContext?.userId ??
          req.user?.id ??
          null,
        action: req.auditContext?.action || inferAction(req),
        endpoint: req.originalUrl.split("?")[0],
        httpMethod: req.method,
        requestData: maskSensitive({
          params: req.params || {},
          query: req.query || {},
          body: req.body || {},
          clientAction: req.headers["x-audit-action"] || null,
          clientSource: req.headers["x-audit-source"] || null,
          clientUserEmail: req.headers["x-audit-user-email"] || null,
        }),
        responseStatus: res.statusCode,
        ipAddress: getClientIp(req),
        oldValue: maskSensitive(req.auditContext?.oldValue),
        newValue: maskSensitive(req.auditContext?.newValue),
        responseBody: maskSensitive(responseBody),
      });
    })();

    const pending = getPendingAuditLogSet();
    pending.add(writePromise);

    try {
      await writePromise;
    } catch (error) {
      console.error("Audit log write failed:", error.message || error);
    } finally {
      pending.delete(writePromise);
    }
  });

  next();
}

module.exports = auditLogger;
module.exports.waitForPendingAuditLogs = waitForPendingAuditLogs;
