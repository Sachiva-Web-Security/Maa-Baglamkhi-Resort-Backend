/**
 * Error middleware shared by every API call.
 *
 * Both pieces are mounted in src/app.js, after every route and middleware:
 *   notFoundMiddleware  - unmatched /api/* request gets a 404 JSON body
 *   errorMiddleware     - every thrown or next(err) error gets one JSON shape
 *
 * Non-/api misses (the frontend dev server, /uploads static files) are handled
 * by src/middleware/rootRoutes.js, which is mounted first.
 *
 * The body is always { message, ... }, which is what the frontend request
 * wrapper reads, so a failure surfaces a sentence instead of a blank page.
 */

const NOT_FOUND_MESSAGE = "Endpoint not found.";

function notFoundMiddleware(req, res) {
  // Every path reaching here is a /api path: rootRoutes answers everything
  // else. req.path is matched against req.path, which is already /api-stripped,
  // so test originalUrl — /api/users resolves to req.path === "users".
  return res.status(404).json({
    message: NOT_FOUND_MESSAGE,
    path: req.originalUrl,
  });
}

function errorMiddleware(err, req, res, next) {
  // body-parser's ECONNRESET-on-malformed-body case should fall through to the
  // request-actor guard, not be swallowed as a 500.
  if (err?.code === "ECONNRESET" && err.detail === "reset") {
    return next();
  }

  // Express 5 routes a malformed JSON body here; it is a bad request, not a crash.
  if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") {
    return res.status(400).json({ message: "Malformed request body." });
  }

  const isProd = process.env.NODE_ENV === "production";
  const status = Number.isInteger(err.status)
    ? err.status
    : Number.isInteger(err.statusCode)
      ? err.statusCode
      : 500;

  if (status >= 500) {
    console.error("[error]", req.method, req.originalUrl, err && err.stack ? err.stack : err);
  }

  return res.status(status).json({
    message:
      status >= 500 && isProd
        ? "Internal server error."
        : err.message || "Request failed.",
    ...(status >= 500 && !isProd ? { stack: err.stack } : {}),
  });
}

module.exports = { errorMiddleware, notFoundMiddleware, NOT_FOUND_MESSAGE };
