/**
 * PrintLogModel — persistent print audit trail.
 *
 * Every print attempt (success or failure) is recorded here.
 * Supports reprint, print history, and print count tracking.
 */

const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS print_logs (
      id INT NOT NULL AUTO_INCREMENT,
      print_no VARCHAR(120) NOT NULL,
      invoice_no VARCHAR(120) DEFAULT NULL,
      kot_no VARCHAR(120) DEFAULT NULL,
      print_type VARCHAR(80) NOT NULL,
      printer_name VARCHAR(255) NOT NULL,
      print_count INT NOT NULL DEFAULT 1,
      printed_by VARCHAR(120) DEFAULT NULL,
      printed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) NOT NULL DEFAULT 'success',
      error_message TEXT DEFAULT NULL,
      metadata JSON DEFAULT NULL,
      PRIMARY KEY (id),
      INDEX idx_print_no (print_no),
      INDEX idx_invoice_no (invoice_no),
      INDEX idx_kot_no (kot_no),
      INDEX idx_print_type (print_type),
      INDEX idx_status (status),
      INDEX idx_printed_at (printed_at)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS print_queue (
      id INT NOT NULL AUTO_INCREMENT,
      job_id VARCHAR(120) NOT NULL,
      print_type VARCHAR(80) NOT NULL,
      payload JSON NOT NULL,
      printer_name VARCHAR(255) NOT NULL,
      priority INT NOT NULL DEFAULT 0,
      retry_count INT NOT NULL DEFAULT 0,
      max_retries INT NOT NULL DEFAULT 3,
      status VARCHAR(50) NOT NULL DEFAULT 'queued',
      error_message TEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      INDEX idx_job_id (job_id),
      INDEX idx_status (status),
      INDEX idx_priority (priority, created_at)
    )
  `);
};

const buildPrintNo = () => `PRN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-6)}`;

const createPrintLog = async (logData) => {
  await ensureSchema();

  const printNo = logData.printNo || buildPrintNo();

  const [result] = await runQuery(
    `INSERT INTO print_logs
      (print_no, invoice_no, kot_no, print_type, printer_name, print_count, printed_by, printed_at, status, error_message, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      printNo,
      logData.invoiceNo || null,
      logData.kotNo || null,
      logData.printType,
      logData.printerName,
      logData.printCount || 1,
      logData.printedBy || null,
      logData.printedAt || new Date(),
      logData.status || "success",
      logData.errorMessage || null,
      JSON.stringify(logData.metadata || {}),
    ],
  );

  return { id: result.insertId, printNo };
};

const updatePrintLog = async (id, updates) => {
  const setParts = [];
  const values = [];

  const fieldMap = {
    status: "status",
    errorMessage: "error_message",
    printCount: "print_count",
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      setParts.push(`${col} = ?`);
      values.push(updates[key]);
    }
  }

  if (!setParts.length) return;

  values.push(id);
  await runQuery(`UPDATE print_logs SET ${setParts.join(", ")} WHERE id = ?`, values);
};

const getPrintHistory = async (filters = {}) => {
  await ensureSchema();

  const conditions = [];
  const params = [];

  if (filters.printType) {
    conditions.push("print_type = ?");
    params.push(filters.printType);
  }
  if (filters.printerName) {
    conditions.push("printer_name = ?");
    params.push(filters.printerName);
  }
  if (filters.invoiceNo) {
    conditions.push("invoice_no = ?");
    params.push(filters.invoiceNo);
  }
  if (filters.kotNo) {
    conditions.push("kot_no = ?");
    params.push(filters.kotNo);
  }
  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters.fromDate) {
    conditions.push("printed_at >= ?");
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    conditions.push("printed_at <= ?");
    params.push(filters.toDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await runQuery(
    `SELECT * FROM print_logs ${whereClause} ORDER BY printed_at DESC LIMIT ? OFFSET ?`,
    [...params, filters.limit || 50, filters.offset || 0],
  );

  return rows.map((row) => ({
    ...row,
    metadata: (() => {
      try {
        return JSON.parse(row.metadata || "{}");
      } catch {
        return {};
      }
    })(),
  }));
};

const getPrintCount = async (invoiceNo, kotNo) => {
  await ensureSchema();

  const conditions = [];
  const params = [];

  if (invoiceNo) {
    conditions.push("invoice_no = ?");
    params.push(invoiceNo);
  }
  if (kotNo) {
    conditions.push("kot_no = ?");
    params.push(kotNo);
  }

  if (!conditions.length) return 0;

  const whereClause = conditions.join(" AND ");
  const [[{ count }]] = await runQuery(
    `SELECT COUNT(*) AS count FROM print_logs WHERE ${whereClause} AND status = 'success'`,
    params,
  );

  return Number(count || 0);
};

const getLastPrint = async (invoiceNo, kotNo) => {
  await ensureSchema();

  const conditions = [];
  const params = [];

  if (invoiceNo) {
    conditions.push("invoice_no = ?");
    params.push(invoiceNo);
  }
  if (kotNo) {
    conditions.push("kot_no = ?");
    params.push(kotNo);
  }

  if (!conditions.length) return null;

  const whereClause = conditions.join(" AND ");
  const rows = await runQuery(
    `SELECT * FROM print_logs WHERE ${whereClause} ORDER BY printed_at DESC LIMIT 1`,
    params,
  );

  return rows[0] || null;
};

module.exports = {
  ensureSchema,
  createPrintLog,
  updatePrintLog,
  getPrintHistory,
  getPrintCount,
  getLastPrint,
  buildPrintNo,
};
