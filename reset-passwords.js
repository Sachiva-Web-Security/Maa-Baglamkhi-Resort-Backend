require("dotenv").config({ quiet: process.env.NODE_ENV === "test" });

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function resetPasswords() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "Sachiva@12345";
  const database = process.env.DB_NAME || "employee3";

  const newPassword = process.argv[2] || "password";

  console.log(`Connecting to ${host}:${port}/${database}...`);

  const conn = await mysql.createConnection({ host, port, user, password, database });
  const hashed = await bcrypt.hash(newPassword, 10);

  const accounts = [
    ["admin@resort.com", "admin"],
    ["manager@resort.com", "manager"],
    ["reception@resort.com", "receptionist"],
    ["accounts@resort.com", "accountant"],
    ["tarun@resort.com", "housekeeping"],
    ["waiter@resort.com", "waiter"],
    ["kitchen@resort.com", "kitchen"],
  ];

  for (const [email] of accounts) {
    const [rows] = await conn.query(
      "SELECT id, name FROM register WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [email]
    );
    if (rows.length === 0) {
      console.log(`  SKIP  ${email} (not found)`);
      continue;
    }
    await conn.query(
      "UPDATE register SET password = ? WHERE LOWER(email) = LOWER(?)",
      [hashed, email]
    );
    console.log(`  OK    ${email} (${rows[0].name})`);
  }

  await conn.end();
  console.log(`\nAll passwords reset to: "${newPassword}"`);
}

resetPasswords().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
