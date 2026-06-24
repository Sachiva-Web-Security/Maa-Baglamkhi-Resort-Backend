/**
 * Centralized error handler.
 *
 * Controllers throw (or call `next(err)`) — this middleware turns the
 * error into a sanitized JSON response. Internal details (stack traces,
 * SQL messages, file paths) are logged server-side and never returned
 * to the client. Each response includes a correlation id so operators
 * can match client reports with server logs.
 *
 * Controllers that previously did:
 *   res.status(500).json({ message: err.message })
 * should now do:
 *   next(err);
 */
const crypto = require("crypto");

const isHttpError = (err) =>
  err && typeof err.status === "number" && err.status >= 400 && err.status < 600;

const isSafeMessage = (err) =>
  err && typeof err.message === "string" && err.message.length < 200 &&
  !/sql|database|stack|at \w+ \(|node_modules|SELECT|INSERT|UPDATE|DELETE/i.test(err.message);

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function errorHandler(err, req, res, next) {
  if (!err) return next();

  const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.set("X-Correlation-Id", correlationId);

  let status = 500;
  let message = "Internal server error";
  let code = undefined;

  if (isHttpError(err)) {
    status = err.status;
    message = isSafeMessage(err) ? err.message : "Request failed";
    code = err.code;
  } else if (err && err.code === "LIMIT_FILE_SIZE") {
    status = 413;
    message = "Uploaded file is too large";
    code = "FILE_TOO_LARGE";
  } else if (err && err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
    code = "INVALID_JSON";
  }

  // Server-side: keep the full error for log scraping.
  // Truncate stack to keep logs readable.
  console.error(
    `[${correlationId}] ${req.method} ${req.originalUrl} -> ${status}`,
    err && err.message,
    err && err.stack ? String(err.stack).split("\n").slice(0, 5).join("\n") : "",
  );

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json({
    message,
    code,
    correlationId,
  });
}

module.exports = errorHandler;
module.exports.HttpError = HttpError;
