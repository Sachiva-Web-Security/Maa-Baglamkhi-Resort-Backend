const mysql = require("mysql2/promise");
const { getDatabaseName, getDbBaseConfig } = require("../config/databaseConfig");

const pool = mysql.createPool({
  host: getDbBaseConfig().host,
  port: Number(getDbBaseConfig().port || 3306),
  user: getDbBaseConfig().user,
  password: getDbBaseConfig().password,
  database: getDatabaseName(),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 50),
  queueLimit: 200,
});

/**
 * Compatibility shim so the callback query style works on a mysql2 promise pool.
 *
 * A promise pool's query(sql, args) ignores a third callback argument, so code
 * written against the callback API hangs forever waiting for a callback that
 * never fires. With this shim both styles work:
 *
 *   await db.query(sql, params)             -> rows
 *   db.query(sql, params, (err, rows) => {}) -> callback receives rows
 *
 * Both resolve to ROWS, never the mysql2 [rows, fields] tuple.
 */
const isResultSetHeader = (value) =>
  !!value && typeof value === "object" && "affectedRows" in value;

// The [rows, fields] tuple cannot be told apart from a SELECT that happens to
// return exactly two rows, so never decide from length alone. execute() is the
 // prepared-statement path: it returns rows for SELECT and a ResultSetHeader
 // for everything else, which is unambiguous.
const unwrapResult = (result) =>
  isResultSetHeader(result) ? result : result[0];

const toCallback = (original, callback) => (sql, params = undefined) => {
  const promise = params === undefined ? original(sql) : original(sql, params);
  promise.then(
    (result) => {
      const rows = unwrapResult(result);
      callback(null, rows, rows);
    },
    (err) => callback(err),
  );
  return promise;
};

const enableCallbackStyle = (target, method) => {
  const original = target[method].bind(target);

  target[method] = function (sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = undefined;
    }

    if (typeof callback === "function") {
      return toCallback(original, callback)(sql, params);
    }

    const promise = params === undefined ? original(sql) : original(sql, params);
    return promise.then(unwrapResult);
  };
};

enableCallbackStyle(pool, "query");
enableCallbackStyle(pool, "execute");

const originalGetConnection = pool.getConnection.bind(pool);

pool.getConnection = async (...args) => {
  const connection = await originalGetConnection(...args);
  enableCallbackStyle(connection, "query");
  enableCallbackStyle(connection, "execute");
  return connection;
};

module.exports = pool;
