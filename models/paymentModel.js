const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const tableName = process.env.PAYMENTS_TABLE_NAME || "payments";

const createUnavailableError = () => {
  const error = new Error("Payments module is temporarily unavailable");
  error.code = "PAYMENTS_TABLE_UNAVAILABLE";
  return error;
};

const createTablespaceError = (sourceError) => {
  const error = new Error(
    `Payments table bootstrap failed for '${tableName}'. The existing database has an orphaned/corrupted tablespace. ` +
      "Use a fresh DB name for a clean setup, or repair the old payments table files first.",
  );
  error.code = "PAYMENTS_TABLESPACE_EXISTS";
  error.cause = sourceError;
  return error;
};

const isPaymentsSchemaAvailable = async () => {
  if (String(process.env.SKIP_PAYMENT_SCHEMA_BOOTSTRAP || "").toLowerCase() === "true") {
    return false;
  }

  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const ensureSchema = async () => {
  try {
    await runQuery(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tableNumber VARCHAR(50) DEFAULT NULL,
        total DECIMAL(10,2) NOT NULL DEFAULT 0,
        paymentMethod VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    if (Number(error.errno) === 1813 || String(error.message || "").includes("Tablespace")) {
      throw createTablespaceError(error);
    }
    throw error;
  }
};

const createPayment = (data, callback) => {
  isPaymentsSchemaAvailable()
    .then((available) => {
      if (!available) {
        callback(createUnavailableError());
        return;
      }

      const sql = `
        INSERT INTO ${tableName} (tableNumber,total,paymentMethod)
        VALUES (?,?,?)
      `;

      db.query(sql, [data.table, data.total, data.method], callback);
    })
    .catch((error) => callback(error));
};

const getPayments = (callback) => {
  isPaymentsSchemaAvailable()
    .then((available) => {
      if (!available) {
        callback(createUnavailableError());
        return;
      }

      db.query(`SELECT * FROM ${tableName} ORDER BY id DESC`, callback);
    })
    .catch((error) => callback(error));
};

module.exports = {
  ensureSchema,
  createPayment,
  getPayments,
};
