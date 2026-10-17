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
 * Nothing here may convert that tuple to a bare value. Every write's
 * ResultSetHeader sits at index 0, and the codebase reads
 * `const [header] = await db.query(...)` then `header.insertId` - InventoryModel,
 * guestModel, roomBlockModel, InvoiceModel. Unwrapping a write would make
 * insertId unreachable and every INSERT that stores its new id back would
 * silently write null.
 *
 * A read is a tuple either way: [[rows], [fields]] from query() and
 * [rows, [fields]] from execute(). The callback branch must unwrap only the
 * outer layer, never pick between rows and a header.
 *
 * And never test result.length === 2. A SELECT returning exactly two rows is
 * indistinguishable from a tuple by length, and SHOW statements return two
 * result sets that must both survive.
 */
// Measured on this server, for every statement type:
//
//   SELECT rows  -> [rows,   fields]   both arrays, r0.len is the row count
//   INSERT       -> [header, undefined] header carries affectedRows / insertId
//   execute()    -> [header, undefined] same, for both reads and writes
//
// query() and execute() therefore always resolve to a [result, fields] tuple.
// The result sits at index 0 and so must never be unwrapped. index 1 is only
// ever an array for a query() read; a write's is undefined, so testing
// result[1] to decide "is this a write" is wrong in both directions.

const isHeader = (result) =>
  !!result && typeof result === "object" && !Array.isArray(result) && "affectedRows" in result;

const withCallback = (promise, callback) => {
  promise.then(
    (result) => {
      // A write returns [header, undefined]; the callback must get the header
      // itself, not the tuple, so insertId stays reachable. A read returns
      // rows as the callback's first result argument.
      const value = isHeader(result) ? result : result[0];
      callback(null, value, result);
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
