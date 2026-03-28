require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET"];

const getMissingEnvVars = () =>
  requiredEnvVars.filter((key) => !String(process.env[key] || "").trim());

const ensureUploadsDir = () => {
  const uploadsDir = path.join(__dirname, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
};

async function runSchemaFile() {
  const schemaPath = path.join(__dirname, "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    return;
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf8").trim();
  if (!schemaSql) {
    return;
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    connectTimeout: 10000,
    multipleStatements: true,
  });

  try {
    await connection.query(schemaSql);
  } finally {
    await connection.end();
  }
}

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    connectTimeout: 10000,
  });

  const databaseName = process.env.DB_NAME;
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
  console.log(`Database: ${process.env.DB_NAME}`);

  try {
    await ensureDatabaseExists();
    console.log("Database verified.");

    await runSchemaFile();
    console.log("Schema file applied.");

    const uploadsDir = ensureUploadsDir();
    console.log(`Uploads directory ready: ${uploadsDir}`);

    const { initializeDatabase } = require("./app");
    await initializeDatabase();

    console.log("Schema bootstrap completed.");
    console.log("Backend initialization finished successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Initialization failed:", error.message || error);
    process.exit(1);
  }
}

run();
