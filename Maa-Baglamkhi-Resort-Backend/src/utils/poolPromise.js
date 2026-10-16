const mysql = require("mysql2/promise");
const { getDatabaseName, getDbBaseConfig } = require("../config/databaseConfig");

const pool = mysql.createPool({
  host: getDbBaseConfig().host,
  port: Number(getDbBaseConfig().port || 3306),
  user: getDbBaseConfig().user,
  password: getDbBaseConfig().password,
  database: getDatabaseName(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
});

/**
 * Promise-based getConnection wrapper (compatibility layer).
 * mysql2/promise pool.getConnection() already returns a Promise,
 * but models were written to call await getConnection().
 */
const getConnection = () => pool.getConnection();

const runQuery = (sql, params = []) => pool.query(sql, params);

module.exports = { pool, getConnection, runQuery };
