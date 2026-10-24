require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const {
  getDatabaseName,
  getDbBaseConfig,
  getDbConnectionLabel,
} = require("./src/config/databaseConfig");

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];

const getMissingEnvVars = () =>
  requiredEnvVars.filter((key) => !String(process.env[key] || "").trim());

const ensureUploadsDir = () => {
  const uploadsDir = path.join(__dirname, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
};

async function runSchemaFile() {
  const schemaPath = path.join(__dirname, "schema-v4.sql");
  if (!fs.existsSync(schemaPath)) {
    return;
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf8").trim();
  if (!schemaSql) {
    return;
  }

  const connection = await mysql.createConnection({
    ...getDbBaseConfig(),
    database: getDatabaseName(),
    multipleStatements: true,
  });

  try {
    await connection.query(schemaSql);
  } finally {
    await connection.end();
  }
}

/**
 * Idempotent migrations for databases that predate a new column or table.
 * `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` keep the
 * migrate step safe to run on every boot.
 */
async function runMigrations(connection) {
  // 1. attendance_records.method — distinguishes manual vs. eSSL-biometric entries
  await connection.query(
    `ALTER TABLE attendance_records
     ADD COLUMN IF NOT EXISTS method ENUM('Manual','Biometric','GPS') NOT NULL DEFAULT 'Manual'
     AFTER leave_type`
  );

  // 2. essl_devices — maps eSSL terminal user ids to employees
  await connection.query(
    `CREATE TABLE IF NOT EXISTS essl_devices (
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
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  // 3. print_queue — background print job queue (polled by services/PrintQueue.js).
  // Without this the print processor loops on "table doesn't exist" every 2s.
  await connection.query(
    `CREATE TABLE IF NOT EXISTS print_queue (
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
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    ...getDbBaseConfig(),
  });

  const databaseName = getDatabaseName();
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  await connection.end();
}

async function run() {
  const missingEnvVars = getMissingEnvVars();
  if (missingEnvVars.length) {
    console.error("Missing required environment variables:");
    missingEnvVars.forEach((key) => console.error(`- ${key}`));
    process.exit(1);
  }

  process.env.NODE_ENV = process.env.NODE_ENV || "production";

  console.log("Starting backend initialization...");
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Database: ${getDatabaseName()}`);
  console.log(`MySQL target: ${getDbConnectionLabel()}`);

  try {
    await ensureDatabaseExists();
    console.log("Database verified.");

    await runSchemaFile();
    console.log("Schema file applied.");

    // Apply idempotent migrations so existing databases pick up new columns/tables
    {
      const connection = await mysql.createConnection({
        ...getDbBaseConfig(),
        database: getDatabaseName(),
      });
      try {
        await runMigrations(connection);
        console.log("Migrations applied.");
      } finally {
        await connection.end();
      }
    }

    const uploadsDir = ensureUploadsDir();
    console.log(`Uploads directory ready: ${uploadsDir}`);

    const { initializeDatabase } = require("./src/app");
    await initializeDatabase();

    console.log("Schema bootstrap completed.");
    console.log("Backend initialization finished successfully.");
    process.exit(0);
  } catch (error) {
    console.error(
      `Initialization failed while connecting to ${getDbConnectionLabel()}:`,
      error.message || error,
    );
    process.exit(1);
  }
}

run();
