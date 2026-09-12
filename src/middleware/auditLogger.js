const AuditLogsModel = require("../models/AuditLogsModel");
const db = require("../config/db");

const SENSITIVE_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "authorization",
  "refreshToken",
]);

const TABLE_NAME = "audit_logs";
const MAX_JSON_LENGTH = 8000;

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

function safeSerialize(value) {
  if (value == null) return null;

  try {
    const text = JSON.stringify(value);
    if (text == null) return null;
    if (text.length <= MAX_JSON_LENGTH) return text;

    return JSON.stringify({
      truncated: true,
      preview: text.slice(0, MAX_JSON_LENGTH),
      originalLength: text.length,
    });
  } catch {
    const fallback = String(value);
    if (fallback.length <= MAX_JSON_LENGTH) return JSON.stringify(fallback);

    return JSON.stringify({
      truncated: true,
      preview: fallback.slice(0, MAX_JSON_LENGTH),
      originalLength: fallback.length,
    });
  }
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

async function ensureAuditLogSchema() {
  const [rows] = await db.promise().query(`
    CREATE TABLE IF NOT EXISTS \`${TABLE_NAME}\` (
      \`id\` BIGINT NOT NULL AUTO_INCREMENT,
      \`user_id\` BIGINT NULL,
      \`action\` VARCHAR(100) NOT NULL,
      \`endpoint\` VARCHAR(255) NOT NULL,
      \`http_method\` VARCHAR(10) NOT NULL,
      \`request_data\` JSON NULL,
      \`response_status\` INT NOT NULL,
      \`ip_address\` VARCHAR(64) NULL,
      \`old_value\` JSON NULL,
      \`new_value\` JSON NULL,
      \`response_body\` JSON NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_audit_user_id\` (\`user_id\`),
      INDEX \`idx_audit_action\` (\`action\`),
      INDEX \`idx_audit_endpoint\` (\`endpoint\`),
      INDEX \`idx_audit_created_at\` (\`created_at\`)
    )
  `);
}

async function createAuditLog(entry) {
  await AuditLogsModel.ensureSchema();

  const payload = {
    user_id: entry.userId ?? null,
    action: entry.action || "unknown",
    endpoint: entry.endpoint || "",
    http_method: entry.httpMethod || "",
    request_data: safeSerialize(entry.requestData),
    response_status: Number(entry.responseStatus || 0),
    ip_address: entry.ipAddress || null,
    old_value: safeSerialize(entry.oldValue),
    new_value: safeSerialize(entry.newValue),
    response_body: safeSerialize(entry.responseBody),
  };

  await db.promise().query(
    `
      INSERT INTO ${TABLE_NAME}
        (user_id, action, endpoint, http_method, request_data, response_status, ip_address, old_value, new_value, response_body)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.user_id,
      payload.action,
      payload.endpoint,
      payload.http_method,
      payload.request_data,
      payload.response_status,
      payload.ip_address,
      payload.old_value,
      payload.new_value,
      payload.response_body,
    ]
  );
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

  res.on("finish", () => {
    const entry = {
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
    };

    const writePromise = createAuditLog(entry).catch((error) => {
      console.error("Audit log write failed:", error.message || error);
    });

    const pending = getPendingAuditLogSet();
    pending.add(writePromise);

    writePromise.finally(() => {
      pending.delete(writePromise);
    });
  });

  next();
}

module.exports = auditLogger;
module.exports.waitForPendingAuditLogs = waitForPendingAuditLogs;
