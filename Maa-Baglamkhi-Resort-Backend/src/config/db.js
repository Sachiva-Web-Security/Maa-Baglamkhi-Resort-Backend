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
 * Compatibility shim for the callback query style, and one shape rule for the
 * whole tree.
 *
 * A mysql2 promise pool's query(sql, args) takes only two arguments, so code
 * written against the callback API
 *
 *   db.query(sql, params, (err, rows) => ...)
 *
 * passes a callback that is silently dropped. The promise still resolves, the
 * callback never fires, and the request hangs until the socket times out.
 *
 * On this server the pool's default multipleStatements is off, so one statement
 * cannot produce more than one result set and query() always resolves to the
 * bare value: rows for a read, the ResultSetHeader for a write. That is what
 * db.execute has always returned, and it is also what the callback branch
 * hands its caller.
 *
 * The reason for this: query() with multipleStatements set to true returns
 * multi-statement results as an array of result sets, which is a two-element
 * array. That collides with the [rows, fields] tuple shape, and it also
 * collides with a SELECT that happens to return exactly two rows. Every
 * tableExists and columnExists call in the codebase reads
 * `const [rows] = await db.query(...)` then tests rows.length - which counted
 * result sets instead of rows, so every such check went permanently true and
 * every schema-drift guard was dead. Resolving to the bare value removes the
 * ambiguity rather than working around it.
 *
 * db.query and db.execute are therefore the same thing here. execute() is kept
 * as an alias because call sites already use it, not because it behaves
 * differently.
 */
const withCallback = (promise, callback) => {
  promise.then(
    (result) => {
      // A write returns a ResultSetHeader, which must stay a header so that
      // insertId is reachable; a SELECT returns rows.
      callback(null, result, result);
    },
    (err) => callback(err),
  );
};

const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);

pool.query = function (sql, params, callback) {
  if (typeof params === "function") {
    callback = params;
    params = undefined;
  }

  const promise = params === undefined ? originalQuery(sql) : originalQuery(sql, params);

  if (typeof callback === "function") {
    withCallback(promise, callback);
  }

  return promise;
};

pool.execute = function (sql, params, callback) {
  if (typeof params === "function") {
    callback = params;
    params = undefined;
  }

  const promise = params === undefined ? originalExecute(sql) : originalExecute(sql, params);

  if (typeof callback === "function") {
    withCallback(promise, callback);
  }

  return promise;
};

const originalGetConnection = pool.getConnection.bind(pool);

pool.getConnection = async (...args) => {
  const connection = await originalGetConnection(...args);

  const originalConnectionQuery = connection.query.bind(connection);
  connection.query = function (sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = undefined;
    }
    const promise =
      params === undefined ? originalConnectionQuery(sql) : originalConnectionQuery(sql, params);
    if (typeof callback === "function") {
      withCallback(promise, callback);
    }
    return promise;
  };

  const originalConnectionExecute = connection.execute.bind(connection);
  connection.execute = function (sql, params, callback) {
    if (typeof params === "function") {
      callback = params;
      params = undefined;
    }
    const promise =
      params === undefined ? originalConnectionExecute(sql) : originalConnectionExecute(sql, params);
    if (typeof callback === "function") {
      withCallback(promise, callback);
    }
    return promise;
  };

  return connection;
};

module.exports = pool;
