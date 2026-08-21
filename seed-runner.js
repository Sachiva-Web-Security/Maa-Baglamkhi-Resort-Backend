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
  if (hasRooms) {
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

  // `guests` table can differ between booking modules (guest_name/guest_email)
  // and seed data (name/email/id docs). Add seed-required columns if missing.
  const hasGuests = await tableExists(connection, "guests");
  if (hasGuests) {
    const requiredGuestColumns = {
      name: "VARCHAR(200) DEFAULT NULL",
      email: "VARCHAR(150) DEFAULT NULL",
      id_type: "VARCHAR(50) DEFAULT NULL",
      id_number: "VARCHAR(100) DEFAULT NULL",
      address: "TEXT DEFAULT NULL",
      city: "VARCHAR(100) DEFAULT NULL",
    };

    for (const [columnName, definition] of Object.entries(requiredGuestColumns)) {
      const exists = await columnExists(connection, "guests", columnName);
      if (!exists) {
        await connection.query(`ALTER TABLE \`guests\` ADD COLUMN \`${columnName}\` ${definition}`);
      }
    }

    // Some deployments created booking_code as NOT NULL DEFAULT ''.
    // Seed inserts don't provide booking_code, so this causes duplicate '' on UNIQUE index.
    // Make it nullable so missing values are stored as NULL (allowed multiple times in UNIQUE).
    if (await columnExists(connection, "guests", "booking_code")) {
      await connection.query(
        "ALTER TABLE `guests` MODIFY COLUMN `booking_code` VARCHAR(40) NULL DEFAULT NULL",
      );
    }
  }

  // Banquet schema differs across modules (`guest_name` vs `customer_name`, etc.).
  // Add seed-required columns so seed.sql can run on either variant.
  const hasBanquetBookings = await tableExists(connection, "banquet_bookings");
  if (hasBanquetBookings) {
    const requiredBanquetBookingColumns = {
      guest_name: "VARCHAR(200) DEFAULT NULL",
      mobile: "VARCHAR(20) DEFAULT NULL",
      event_date: "DATE DEFAULT NULL",
      guest_count: "INT DEFAULT 0",
      advance_paid: "DECIMAL(10,2) DEFAULT 0",
      total_amount: "DECIMAL(10,2) DEFAULT 0",
    };

    for (const [columnName, definition] of Object.entries(requiredBanquetBookingColumns)) {
      const exists = await columnExists(connection, "banquet_bookings", columnName);
      if (!exists) {
        await connection.query(
          `ALTER TABLE \`banquet_bookings\` ADD COLUMN \`${columnName}\` ${definition}`,
        );
      }
    }
  }

  const hasBanquetHalls = await tableExists(connection, "banquet_halls");
  if (hasBanquetHalls) {
    const hasRatePerHour = await columnExists(connection, "banquet_halls", "rate_per_hour");
    if (!hasRatePerHour) {
      await connection.query(
        "ALTER TABLE `banquet_halls` ADD COLUMN `rate_per_hour` DECIMAL(10,2) DEFAULT 0",
      );
    }
  }

  // Attendance schema differs (`employee_name/check_in/check_out`) vs seed (`staff_name/in_time/out_time`).
  const hasAttendance = await tableExists(connection, "attendance_records");
  if (hasAttendance) {
    const requiredAttendanceColumns = {
      staff_name: "VARCHAR(100) DEFAULT NULL",
      role: "VARCHAR(50) DEFAULT NULL",
      date: "DATE DEFAULT NULL",
      status: "VARCHAR(20) DEFAULT NULL",
      in_time: "VARCHAR(10) DEFAULT NULL",
      out_time: "VARCHAR(10) DEFAULT NULL",
    };

    for (const [columnName, definition] of Object.entries(requiredAttendanceColumns)) {
      const exists = await columnExists(connection, "attendance_records", columnName);
      if (!exists) {
        await connection.query(
          `ALTER TABLE \`attendance_records\` ADD COLUMN \`${columnName}\` ${definition}`,
        );
      }
    }
  }

  const hasAssignments = await tableExists(connection, "assignments");
  if (hasAssignments) {
    const requiredAssignmentColumns = {
      staff_name: "VARCHAR(100) DEFAULT NULL",
      room_number: "VARCHAR(50) DEFAULT NULL",
      task: "TEXT DEFAULT NULL",
      assigned_by: "VARCHAR(100) DEFAULT NULL",
      status: "VARCHAR(50) DEFAULT 'Pending'",
    };

    for (const [columnName, definition] of Object.entries(requiredAssignmentColumns)) {
      const exists = await columnExists(connection, "assignments", columnName);
      if (!exists) {
        await connection.query(
          `ALTER TABLE \`assignments\` ADD COLUMN \`${columnName}\` ${definition}`,
        );
      }
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
