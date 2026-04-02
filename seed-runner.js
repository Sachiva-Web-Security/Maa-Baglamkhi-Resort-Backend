require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

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
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "employee",
    connectTimeout: 10000,
    multipleStatements: true,
  });

  try {
    console.log(`Seeding database: ${process.env.DB_NAME || "employee"}`);
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
