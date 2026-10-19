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
 * Both query() and execute() always resolve to a [result, fields] tuple.
 * Measured on this server for every statement type, both with and without
 * params, pool-wide and per-connection:
 *
 *   SELECT -> [rows, fields]    result is the row array
 *   INSERT -> [ResultSetHeader, null]
 *   execute -> [ResultSetHeader, null] same for reads and writes
 *
 * The promise is resolved unwrapped: a write hands back the bare
 * ResultSetHeader ({ fieldCount, affectedRows, insertId, info, ... }), a read
 * keeps its [rows, fields] tuple. The split is on the value at index 0, never
 * on length and never on the SQL text - a header is an object carrying
 * affectedRows, a read is an array of row objects, so a SELECT of exactly two
 * rows and a SHOW statement with two result sets still keep their tuple.
 *
 * Unwrapping is what makes a created id round-trip. The repo reads insertId two
 * ways: `const [header] = await db.query(...)` then `header.insertId` and bare
 * `result = await db.query(...)` then `result.insertId` (notificationController,
 * BanquetModel, InventoryModel, ...). On a tuple only the first reaches the id;
 * the bare form got undefined. Unwrapped, both land on the same header, so the
 * comma in the destructured form is a vestige that changes nothing.
 *
 * Reads are never unwrapped, so every SELECT keeps the tuple shape each call
 * site destructures.
 */
const isHeader = (result) =>
  Array.isArray(result) && !!result[0] && typeof result[0] === "object" && "affectedRows" in result[0];

const unwrap = (result) => (isHeader(result) ? result[0] : result);

// The promise above is already unwrapped: a write is a bare ResultSetHeader, a
// read is the [rows, fields] tuple.  The callback API hands back rows in
// arg1, so pass result[0] for a read (the row array) and result for a write.
// Every model in this repo written in the callback style does
//   db.query(sql, params, (err, rows) => resolve(rows))
// and expects `rows` to be the bare row array, not the tuple.
const withCallback = (promise, callback) => {
  promise.then((result) => {
    const isRead = Array.isArray(result) && result.length >= 2;
    callback(null, isRead ? result[0] : result, isRead ? result[1] : result);
  }, (err) => callback(err));
};

const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);

pool.query = function (sql, params, callback) {
  if (typeof params === "function") {
    callback = params;
    params = undefined;
  }

  const promise = unwrap(params === undefined ? originalQuery(sql) : originalQuery(sql, params));

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

  const promise = unwrap(params === undefined ? originalExecute(sql) : originalExecute(sql, params));

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
      unwrap(params === undefined ? originalConnectionQuery(sql) : originalConnectionQuery(sql, params));
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
      unwrap(params === undefined ? originalConnectionExecute(sql) : originalConnectionExecute(sql, params));
    if (typeof callback === "function") {
      withCallback(promise, callback);
    }
    return promise;
  };

  return connection;
};

module.exports = pool;
