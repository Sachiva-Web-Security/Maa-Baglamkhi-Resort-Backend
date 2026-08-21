require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const {
  getDatabaseName,
  getDbBaseConfig,
  getDbConnectionLabel,
} = require("./config/databaseConfig");

const dbName = getDatabaseName();

const createPaymentsTableSql = `
  CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tableNumber VARCHAR(50) DEFAULT NULL,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    paymentMethod VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;

async function main() {
  let connection;

  try {
    connection = await mysql.createConnection({
      ...getDbBaseConfig(),
      database: dbName,
    });

    console.log(`Checking payments table in database: ${dbName}`);

    const [datadirRows] = await connection.query("SHOW VARIABLES LIKE 'datadir'");
    const dataDir = datadirRows?.[0]?.Value || datadirRows?.[0]?.value || null;
    const databaseDir = dataDir ? path.join(dataDir, dbName) : null;

    try {
      await connection.query("DROP TABLE IF EXISTS payments");
      console.log("Dropped existing payments table metadata if present.");
    } catch (error) {
      console.log(`DROP TABLE warning: ${error.message}`);
    }

    try {
      await connection.query(createPaymentsTableSql);
      console.log("Payments table created successfully.");
      process.exit(0);
    } catch (error) {
      if (Number(error.errno) !== 1813 && !String(error.message || "").includes("Tablespace")) {
        throw error;
      }

      console.error("Payments table still cannot be created because orphan tablespace files exist.");

      if (databaseDir) {
        console.error(`Database folder: ${databaseDir}`);

        try {
          const matchingFiles = fs
            .readdirSync(databaseDir)
            .filter((name) => /^payments\./i.test(name));

          if (matchingFiles.length) {
            console.error("Rename or remove these files after stopping MySQL:");
            matchingFiles.forEach((file) => console.error(`- ${path.join(databaseDir, file)}`));
          } else {
            console.error("No payments.* files were found in the database folder.");
          }
        } catch (fsError) {
          console.error(`Could not inspect database folder: ${fsError.message}`);
        }
      }

      console.error("Next steps:");
      console.error("1. Stop MySQL.");
      console.error("2. Rename/remove the listed payments.* files.");
      console.error("3. Start MySQL.");
      console.error("4. Run: npm run repair:payments");
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Payments repair failed while connecting to ${getDbConnectionLabel()}:`,
      error.message || error,
    );
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (_) {}
    }
  }
}

main();
