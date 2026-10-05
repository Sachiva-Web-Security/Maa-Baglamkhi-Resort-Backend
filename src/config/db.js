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
 * Compatibility shim for the callback query style.
 *
 * Parts of the codebase were written against the callback API:
 *   db.query(sql, params, (err, rows) => ...)
 *
 * This pool is a mysql2 *promise* pool, whose query(sql, args) takes only two
 * arguments — a third callback is silently ignored. The callback therefore
 * never fires and the request hangs until it times out.
 *
 * With this shim both styles work:
 *   await db.query(sql, params)                -> [rows, fields]
 *   db.query(sql, params, (err, rows) => {})   -> callback receives rows
 */
const enableCallbackStyle = (target, method) => {
  const original = target[method].bind(target);

  target[method] = function (sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = undefined;
    }

    const promise = params === undefined ? original(sql) : original(sql, params);

    if (typeof callback === "function") {
      promise.then(
        (result) => {
          // The promise API resolves [rows, fields]; callback style expects the
          // rows (or ResultSetHeader) directly, plus fields as third argument.
          const isTuple = Array.isArray(result) && result.length === 2;
          callback(null, isTuple ? result[0] : result, isTuple ? result[1] : undefined);
        },
        (err) => callback(err),
      );
    }

    return promise;
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
