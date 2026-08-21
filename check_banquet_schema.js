require("dotenv").config();
const db = require("./config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const requiredHallColumns = {
  name: "VARCHAR(255) NOT NULL",
  capacity: "INT NOT NULL",
  is_ac: "BOOLEAN DEFAULT TRUE",
  image: "VARCHAR(255) DEFAULT NULL",
  status: "VARCHAR(50) DEFAULT 'Available'",
};

const requiredBookingColumns = {
  hall_id: "INT NOT NULL",
  customer_name: "VARCHAR(255) NOT NULL",
  event_type: "VARCHAR(100) NOT NULL",
  guests: "INT NOT NULL",
  date: "DATE NOT NULL",
  start_time: "TIME NOT NULL",
  end_time: "TIME NOT NULL",
  status: "VARCHAR(50) DEFAULT 'Confirmed'",
};

const ensureTableExists = async (tableName, createSQL) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  if (rows.length) {
    console.log(`TABLE ${tableName} EXISTS`);
    return;
  }
  console.log(`TABLE ${tableName} DOES NOT EXIST. Creating...`);
  await runQuery(createSQL);
  console.log(`TABLE ${tableName} CREATED`);
};

const getColumnNames = async (tableName) => {
  const cols = await runQuery(`DESCRIBE ${tableName}`);
  return cols.map((col) => col.Field);
};

const ensureColumns = async (tableName, requiredMap) => {
  const existing = await getColumnNames(tableName);
  const missing = Object.entries(requiredMap)
    .filter(([name]) => !existing.includes(name))
    .map(([name, type]) => `ADD COLUMN ${name} ${type}`);

  if (!missing.length) {
    console.log(`All required columns present in ${tableName}`);
    return;
  }

  console.log(`Adding missing columns in ${tableName}: ${missing.join(", ")}`);
  await runQuery(`ALTER TABLE ${tableName} ${missing.join(", ")}`);
  console.log(`Columns added in ${tableName}`);
};

const detectHallRateColumn = async () => {
  const hallColumns = await getColumnNames("banquet_halls");
  if (hallColumns.includes("ratePerHour")) return "ratePerHour";
  if (hallColumns.includes("rate_per_hour")) return "rate_per_hour";

  await runQuery(
    "ALTER TABLE banquet_halls ADD COLUMN ratePerHour DECIMAL(10,2) NOT NULL DEFAULT 0"
  );
  console.log("Added missing hall rate column: ratePerHour");
  return "ratePerHour";
};

const run = async () => {
  try {
    await ensureTableExists(
      "banquet_halls",
      `
      CREATE TABLE banquet_halls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        capacity INT NOT NULL,
        ratePerHour DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Available',
        image VARCHAR(255) DEFAULT NULL,
        is_ac BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
      `
    );

    await ensureTableExists(
      "banquet_bookings",
      `
      CREATE TABLE banquet_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hall_id INT NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        phone VARCHAR(30) DEFAULT '',
        guest_email VARCHAR(255) DEFAULT '',
        event_title VARCHAR(255) DEFAULT '',
        event_type VARCHAR(100) NOT NULL,
        guests INT NOT NULL,
        menu_package_id VARCHAR(50) DEFAULT 'standard',
        meal_section VARCHAR(100) DEFAULT '',
        custom_menu_items TEXT,
        lighting_system VARCHAR(100) DEFAULT 'classic',
        decoration_fee DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0,
        gst_percent DECIMAL(5,2) DEFAULT 5,
        invoice_no VARCHAR(100) DEFAULT '',
        status VARCHAR(50) DEFAULT 'Confirmed',
        advance DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
      `
    );

    await ensureColumns("banquet_halls", requiredHallColumns);
    await ensureColumns("banquet_bookings", requiredBookingColumns);

    const hallRateColumn = await detectHallRateColumn();
    console.log(`Active hall rate column: ${hallRateColumn}`);

    const testName = "__schema_test_hall__";
    await runQuery(
      `INSERT INTO banquet_halls (name, capacity, ${hallRateColumn}, image, is_ac, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [testName, 100, 5000, null, 1, "Available"]
    );
    await runQuery("DELETE FROM banquet_halls WHERE name = ?", [testName]);
    console.log("Insert test passed");

    console.log("Banquet schema check completed successfully");
    db.end();
  } catch (error) {
    console.error("Schema check failed:", error.message);
    db.end();
    process.exit(1);
  }
};

run();
