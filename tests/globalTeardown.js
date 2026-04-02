module.exports = async () => {
  const db = require("../config/db");
  try {
    const { io, server } = require("../app");
    try {
      await io.close();
    } catch {
      // ignore teardown noise
    }
    try {
      await new Promise((resolve) => server.close(() => resolve()));
    } catch {
      // ignore teardown noise
    }
  } catch {
    // ignore app teardown import failures
  }

  await db.promise().end();
};
