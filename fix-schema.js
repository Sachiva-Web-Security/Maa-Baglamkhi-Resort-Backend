/**
 * fix-schema.js — portable, idempotent schema repair for stock MySQL.
 *
 * Two entry points:
 *   1. `node fix-schema.js`  — run manually on a machine after `npm install`
 *      to guarantee the database matches what the backend expects.
 *   2. `require("./fix-schema").runSelfRepair()` — called automatically at
 *      backend boot from index.js so any PC self-heals without manual steps.
 *
 * Every statement is stock-MySQL-compatible (no MariaDB-only `IF NOT EXISTS`
 * column syntax), and every probe is against information_schema so re-runs
 * are no-ops.
 */

require("dotenv").config({ quiet: true });
const mysql = require("mysql2/promise");
const { getDatabaseName, getDbBaseConfig } = require("./src/config/databaseConfig");

/* ── What a healthy DB must contain ────────────────────────────────────── */

// CREATE TABLE IF NOT EXISTS — always safe on both engines.
const REQUIRED_TABLES = {
  essl_devices: `CREATE TABLE IF NOT EXISTS essl_devices (
       id INT UNSIGNED NOT NULL AUTO_INCREMENT,
       device_name VARCHAR(100) NOT NULL,
       serial_number VARCHAR(60),
       connection VARCHAR(30) NOT NULL DEFAULT 'COM',
       baud_rate INT NOT NULL DEFAULT 9600,
       employee_id BIGINT UNSIGNED NOT NULL,
       employee_email VARCHAR(160) NOT NULL,
       terminal_user_id INT UNSIGNED NOT NULL,
       active TINYINT(1) NOT NULL DEFAULT 1,
       last_sync_at DATETIME,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       UNIQUE KEY uniq_terminal_user (terminal_user_id),
       KEY idx_employee (employee_id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  print_queue: `CREATE TABLE IF NOT EXISTS print_queue (
       id INT UNSIGNED NOT NULL AUTO_INCREMENT,
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
       KEY idx_job_id (job_id),
       KEY idx_status (status),
       KEY idx_priority (priority, created_at)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
};

// ALTER TABLE ... ADD COLUMN, gated by an information_schema probe.
const REQUIRED_COLUMNS = [
  { table: "attendance_records", column: "method",
    ddl: "ALTER TABLE attendance_records ADD COLUMN method " +
         "ENUM('Manual','Biometric','GPS') NOT NULL DEFAULT 'Manual' AFTER leave_type" },
  { table: "invoices", column: "invoice_date",
    ddl: "ALTER TABLE invoices ADD COLUMN invoice_date DATE NULL AFTER invoice_type" },
];

const tableExists = async (db, name) => {
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [name]
  );
  return rows.length > 0;
};

const columnExists = async (db, table, column) => {
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
    [table, column]
  );
  return rows.length > 0;
};

/* ── The repair ────────────────────────────────────────────────────────── */

const runSelfRepair = async (log = () => {}) => {
  const db = await mysql.createConnection({
    ...getDbBaseConfig(),
    database: getDatabaseName(),
  });
  const report = { addedColumns: [], createdTables: [], skipped: [] };
  try {
    // 1. Columns — only touch a table if it already exists (a missing
    //    table is handled by the model's own CREATE, not by us).
    for (const spec of REQUIRED_COLUMNS) {
      if (!(await tableExists(db, spec.table))) {
        report.skipped.push(`${spec.table} (table missing — owned by its model)`);
        continue;
      }
      if (!(await columnExists(db, spec.table, spec.column))) {
        await db.query(spec.ddl);
        report.addedColumns.push(`${spec.table}.${spec.column}`);
        log(`[fix-schema] added ${spec.table}.${spec.column}`);
      }
    }

    // 2. Tables — CREATE IF NOT EXISTS is a no-op when present.
    for (const [name, ddl] of Object.entries(REQUIRED_TABLES)) {
      if (!(await tableExists(db, name))) {
        await db.query(ddl);
        report.createdTables.push(name);
        log(`[fix-schema] created table ${name}`);
      }
    }
  } finally {
    await db.end();
  }
  return report;
};

module.exports = { runSelfRepair };

/* Manual entry point */
if (require.main === module) {
  runSelfRepair((line) => console.log(line)).then((report) => {
    console.log("Schema repair complete.");
    console.log("  added columns :", report.addedColumns.length ? report.addedColumns.join(", ") : "none");
    console.log("  created tables:", report.createdTables.length ? report.createdTables.join(", ") : "none");
    console.log("  skipped       :", report.skipped.length ? report.skipped.join(", ") : "none");
    process.exit(0);
  }).catch((err) => {
    console.error("fix-schema.js failed:", err.message);
    process.exit(1);
  });
}
