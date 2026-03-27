module.exports = async () => {
  const db = require("../config/db");
  await db.promise().end();
};
