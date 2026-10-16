const router = require("express").Router();

/**
 * Mounted after all /api routes. Anything that is not an /api request and is
 * not a real static file lands here, so it gets a plain message instead of a
 * dropped connection.
 */
router.use((req, res) => {
  return res.status(404).send("Not found");
});

module.exports = router;
