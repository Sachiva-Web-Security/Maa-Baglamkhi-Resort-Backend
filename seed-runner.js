require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { getDatabaseName, getDbBaseConfig } = require("./config/databaseConfig");

const seedPath = path.join(__dirname, "seed.sql");

async function tableExists(connection, tableName) {
  const [rows] = await connection.query("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureSeedCompatibility(connection) {
  // Older deployments may have a minimal `rooms` table created by legacy code.
  // Add columns expected by seed.sql without dropping live data.
  const hasRooms = await tableExists(connection, "rooms");
  if (!hasRooms) return;

  const requiredRoomColumns = {
    room_type: "VARCHAR(50) DEFAULT NULL",
    price: "DECIMAL(10,2) DEFAULT NULL",
    category_id: "INT DEFAULT NULL",
    room_name: "VARCHAR(120) DEFAULT NULL",
    floor_name: "VARCHAR(50) DEFAULT NULL",
    housekeeping_status: "VARCHAR(50) NOT NULL DEFAULT 'Vacant Clean'",
  };

  for (const [columnName, definition] of Object.entries(requiredRoomColumns)) {
    const exists = await columnExists(connection, "rooms", columnName);
    if (!exists) {
      await connection.query(`ALTER TABLE \`rooms\` ADD COLUMN \`${columnName}\` ${definition}`);
    }
  }
}

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
    await ensureSeedCompatibility(connection);
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
