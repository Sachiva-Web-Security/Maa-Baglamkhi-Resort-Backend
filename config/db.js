const mysql = require("mysql2");
require("dotenv").config({ quiet: process.env.NODE_ENV === "test" });

const resolvedDatabase =
  process.env.NODE_ENV === "test" && process.env.DB_NAME_TEST
    ? process.env.DB_NAME_TEST
    : process.env.DB_NAME || "employee";

const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: resolvedDatabase,
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
});

module.exports = db;
