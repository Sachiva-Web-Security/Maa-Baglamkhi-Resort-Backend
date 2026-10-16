/**
 * Mounted after every /api route. It exists so a request that is not an API
 * call and is not a real static file returns a plain message instead of being
 * dropped. Without it the frontend dev server gets a 500 here.
 *
 * Mounted with app.use(...) — not a Router — because inside a Router every
 * unmatched path falls through to express's own error page, which is exactly
 * the drop this middleware is there to prevent.
 *
 * /api misses are handled by notFoundMiddleware in errorHandler.js, which is
 * mounted right after this middleware.
 */
function rootRoutes(req, res, next) {
  if (req.originalUrl.startsWith("/api")) {
    return next();
  }
  return res.status(404).send("Not found");
}

module.exports = rootRoutes;
