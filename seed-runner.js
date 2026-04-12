require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { getDatabaseName, getDbBaseConfig } = require("./config/databaseConfig");

const seedPath = path.join(__dirname, "seed.sql");

async function runSeed() {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found: ${seedPath}`);
  }

  const sql = fs.readFileSync(seedPath, "utf8").trim();
  if (!sql) {
    throw new Error("Seed file is empty.");
  }

  const connection = await mysql.createConnection({
    ...getDbBaseConfig(),
    database: getDatabaseName(),
    multipleStatements: true,
  });

  try {
    console.log(`Seeding database: ${getDatabaseName()}`);
    await connection.query(sql);
    console.log("Database seed completed successfully.");
  } finally {
    await connection.end();
  }
}

runSeed().catch((error) => {
  console.error("Database seed failed:", error.message || error);
  process.exit(1);
});
