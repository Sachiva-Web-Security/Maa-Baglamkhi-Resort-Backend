const db = require("../config/db");

const TABLE_NAME = "audit_logs";

async function ensureSchema() {
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NULL,
      action VARCHAR(100) NOT NULL,
      endpoint VARCHAR(255) NOT NULL,
      http_method VARCHAR(10) NOT NULL,
      request_data JSON NULL,
      response_status INT NOT NULL,
      ip_address VARCHAR(64) NULL,
      old_value JSON NULL,
      new_value JSON NULL,
      response_body JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_audit_user_id (user_id),
      INDEX idx_audit_action (action),
      INDEX idx_audit_endpoint (endpoint),
      INDEX idx_audit_created_at (created_at)
    )
  `);
}

async function createLog(entry) {
  const payload = {
    user_id: entry.userId ?? null,
    action: entry.action || "unknown",
    endpoint: entry.endpoint || "",
    http_method: entry.httpMethod || "",
    request_data: entry.requestData ?? null,
    response_status: Number(entry.responseStatus || 0),
    ip_address: entry.ipAddress || null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    response_body: entry.responseBody ?? null,
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
      JSON.stringify(payload.request_data),
      payload.response_status,
      payload.ip_address,
      JSON.stringify(payload.old_value),
      JSON.stringify(payload.new_value),
      JSON.stringify(payload.response_body),
    ],
  );
}

function parseJson(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function listLogs(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  const page = Math.max(Number(filters.page || 1), 1);
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (filters.search) {
    where.push("(l.action LIKE ? OR l.endpoint LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
    const search = `%${filters.search}%`;
    params.push(search, search, search, search);
  }

  if (filters.action) {
    where.push("l.action = ?");
    params.push(filters.action);
  }

  if (filters.status) {
    where.push("l.response_status = ?");
    params.push(Number(filters.status));
  }

  if (filters.dateFrom) {
    where.push("DATE(l.created_at) >= ?");
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    where.push("DATE(l.created_at) <= ?");
    params.push(filters.dateTo);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.promise().query(
    `
      SELECT
        l.*,
        u.name AS user_name,
        u.email AS user_email
      FROM ${TABLE_NAME} l
      LEFT JOIN register u ON u.id = l.user_id
      ${whereClause}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset],
  );

  const [countRows] = await db.promise().query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN l.response_status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN l.response_status >= 400 THEN 1 ELSE 0 END) AS error_count,
        COUNT(DISTINCT l.user_id) AS unique_users
      FROM ${TABLE_NAME} l
      LEFT JOIN register u ON u.id = l.user_id
      ${whereClause}
    `,
    params,
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      request_data: parseJson(row.request_data),
      old_value: parseJson(row.old_value),
      new_value: parseJson(row.new_value),
      response_body: parseJson(row.response_body),
    })),
    summary: {
      total: Number(countRows?.[0]?.total || 0),
      successCount: Number(countRows?.[0]?.success_count || 0),
      errorCount: Number(countRows?.[0]?.error_count || 0),
      uniqueUsers: Number(countRows?.[0]?.unique_users || 0),
    },
    pagination: {
      page,
      limit,
      total: Number(countRows?.[0]?.total || 0),
      totalPages: Math.max(1, Math.ceil(Number(countRows?.[0]?.total || 0) / limit)),
    },
  };
}

module.exports = {
  ensureSchema,
  createLog,
  listLogs,
};
