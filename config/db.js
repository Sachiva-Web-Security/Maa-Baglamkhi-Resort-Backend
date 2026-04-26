const mysql = require("mysql2");
const { getDatabaseName, getDbBaseConfig } = require("./databaseConfig");

const db = mysql.createPool({
  ...getDbBaseConfig(),
  database: getDatabaseName(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,

  // 🔥 ADD THESE 2 LINES (MOST IMPORTANT)
  timezone: "Z",
  dateStrings: true
});

module.exports = db;
