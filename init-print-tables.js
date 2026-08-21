/**
 * init-print-tables.js
 *
 * Creates the print_logs and print_queue tables if they don't exist.
 * Run this once after deploying the print system.
 *
 * Usage: node backend/init-print-tables.js
 */

const db = require("./config/db");

const runQuery = (sql) =>
  new Promise((resolve, reject) => {
    db.query(sql, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

async function init() {
  try {
    // Test connection
    await runQuery("SELECT 1");
    console.log("MySQL Connected");

    // Create print_logs table
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
    console.log("print_logs table ready");

    // Create print_queue table
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
    console.log("print_queue table ready");

    console.log("\nPrint system tables initialized successfully!");
  } catch (err) {
    console.error("Failed to initialize print tables:", err.message);
    process.exit(1);
  }
}

init();
