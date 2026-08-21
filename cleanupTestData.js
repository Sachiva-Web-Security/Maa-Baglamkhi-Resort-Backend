/**
 * cleanupTestData.js
 *
 * Development utility to remove test/dummy data from the hotel management
 * database.  Run it ONLY against a non-production database.
 *
 * Usage:
 *   node cleanupTestData.js                      # interactive menu
 *   node cleanupTestData.js --all                # wipe every supported table
 *   node cleanupTestData.js --guests --bills --inventory
 *                                                # selective by module
 *
 * Supported modules:
 *   --users          Test users (non-admin / non-manager)
 *   --guests         Guest bookings + related tariffs, folio, docs, pax, advances
 *   --restaurant     Restaurant POS data (tables, orders, bills, tokens, items)
 *   --inventory      Inventory adjustments, waste logs, POs, transfers,
 *                    vendor inwards/payments, chef issues, stock ledger, audit
 *   --banquet        Banquet bookings (halls are preserved)
 *   --accounts       Manual accounts_transactions and vendor payment / PO mirrors
 *   --housekeeping   Housekeeping rooms, logs, messages, amenities, inspections,
 *                    shift roster, costing
 *   --attendance     Attendance records
 *   --logs           Audit logs and print logs
 *   --all            All of the above
 */

require("dotenv").config({ quiet: true });

const readline = require("readline");
const mysql = require("mysql2/promise");
const {
  getDatabaseName,
  getDbBaseConfig,
  getDbConnectionLabel,
} = require("./config/databaseConfig");

const CONFIRM_PHRASE = "YES_DELETE_TEST_DATA";

const MODULE_DESCRIPTIONS = {
  users: "Test users (non-admin / non-manager accounts)",
  guests:
    "Guest bookings, tariffs, folio entries, guest documents, pax records, advance payments",
  restaurant:
    "Restaurant POS – tables, orders, bills, tokens, order items, split bills, action requests",
  inventory:
    "Inventory adjustments – waste logs, purchase orders, transfers, vendor inwards/payments, " +
    "chef issues, stock ledger entries, stock audit",
  banquet: "Banquet bookings (halls are preserved)",
  accounts:
    "Manual accounts transactions and accounts-mirror vendor payments / purchase orders",
  housekeeping:
    "Housekeeping rooms, logs, WhatsApp messages, amenities, inspections, shift roster, costing",
  attendance: "Attendance records",
  logs: "Audit logs and print logs",
};

const SUPPORTED_MODULES = Object.keys(MODULE_DESCRIPTIONS);

function parseArgs() {
  const args = process.argv.slice(2);
  const selected = new Set();

  if (args.includes("--all")) {
    SUPPORTED_MODULES.forEach((m) => selected.add(m));
    return selected;
  }

  for (const arg of args) {
    const clean = arg.replace(/^--/, "");
    if (SUPPORTED_MODULES.includes(clean)) {
      selected.add(clean);
    }
  }

  return selected;
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tableExists = async (conn, tableName) => {
  const [rows] = await conn.query("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const countRows = async (conn, tableName, whereClause = "", params = []) => {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM \`${tableName}\` ${whereClause}`,
    params
  );
  return Number(rows?.[0]?.c || 0);
};

const deleteWhere = async (conn, tableName, whereClause, params = []) => {
  const [result] = await conn.query(
    `DELETE FROM \`${tableName}\` ${whereClause}`,
    params
  );
  return result.affectedRows;
};

const truncateTable = async (conn, tableName) => {
  await conn.query(`TRUNCATE TABLE \`${tableName}\``);
};

// ─── Module cleanup functions ─────────────────────────────────────────────────

async function cleanupUsers(conn, dryRun) {
  if (!(await tableExists(conn, "register"))) {
    return "Users: register table not found – skipped";
  }

  const count = await countRows(
    conn,
    "register",
    "WHERE LOWER(role) NOT IN ('admin','manager','superadmin','owner')"
  );

  if (!dryRun && count > 0) {
    await deleteWhere(
      conn,
      "register",
      "WHERE LOWER(role) NOT IN ('admin','manager','superadmin','owner')"
    );
  }

  return `Users: ${dryRun ? "would delete" : "deleted"} ${count} non-admin user(s)`;
}

async function cleanupGuests(conn, dryRun) {
  if (!(await tableExists(conn, "guests"))) {
    return "Guests: guests table not found – skipped";
  }

  // Prefer explicit test guests (booking_code starts with BK-TEST or name
  // contains 'test' / 'dummy').  Fall back to all guests if none match.
  const [testGuestRows] = await conn.query(
    `SELECT id FROM guests
     WHERE LOWER(booking_code) LIKE 'bk-test%'
        OR LOWER(guest_name) LIKE '%test%'
        OR LOWER(guest_name) LIKE '%dummy%'
     ORDER BY id`
  );

  let guestIds = testGuestRows.map((r) => r.id);

  if (guestIds.length === 0) {
    const [allRows] = await conn.query("SELECT id FROM guests ORDER BY id");
    guestIds = allRows.map((r) => r.id);
  }

  if (guestIds.length === 0) {
    return "Guests: no guest records found – skipped";
  }

  const placeholders = guestIds.map(() => "?").join(", ");
  const idParams = guestIds;
  let relatedDeleted = 0;

  if (!dryRun) {
    // Delete child tables first (respecting FK order).

    if (await tableExists(conn, "hotel_folio_entries")) {
      relatedDeleted += await deleteWhere(
        conn,
        "hotel_folio_entries",
        `WHERE booking_id IN (${placeholders})`,
        idParams
      );
    }

    if (await tableExists(conn, "room_tariff")) {
      relatedDeleted += await deleteWhere(
        conn,
        "room_tariff",
        `WHERE booking_id IN (${placeholders})`,
        idParams
      );
    }

    if (await tableExists(conn, "advance_payment")) {
      relatedDeleted += await deleteWhere(
        conn,
        "advance_payment",
        `WHERE booking_id IN (${placeholders})`,
        idParams
      );
    }

    if (await tableExists(conn, "guest_documents")) {
      relatedDeleted += await deleteWhere(
        conn,
        "guest_documents",
        `WHERE booking_id IN (${placeholders})`,
        idParams
      );
    }

    if (await tableExists(conn, "pax")) {
      relatedDeleted += await deleteWhere(
        conn,
        "pax",
        `WHERE booking_id IN (${placeholders})`,
        idParams
      );
    }

    if (await tableExists(conn, "other_booking")) {
      relatedDeleted += await deleteWhere(
        conn,
        "other_booking",
        `WHERE guest_id IN (${placeholders})`,
        idParams
      );
    }

    if (await tableExists(conn, "invoices")) {
      const invoiceParams = [...idParams, ...idParams];
      const invoicePlaceholders = [...Array(idParams.length).fill("?"), ...Array(idParams.length).fill("?")].join(", ");
      relatedDeleted += await deleteWhere(
        conn,
        "invoices",
        `WHERE booking_id IN (${placeholders}) OR customer_id IN (${placeholders})`,
        invoiceParams
      );
    }

    await deleteWhere(conn, "guests", `WHERE id IN (${placeholders})`, idParams);
  }

  return `Guests: ${dryRun ? "would delete" : "deleted"} ${guestIds.length} guest(s) and ~${dryRun ? 0 : relatedDeleted} related row(s)`;
}

async function cleanupRestaurant(conn, dryRun) {
  const tables = [
    "restaurant_item_action_requests",
    "restaurant_split_bills",
    "restaurant_bills",
    "order_items",
    "orders",
    "bills",
    "token_items",
    "tokens",
    "restaurant_tables",
  ];

  let totalRows = 0;
  let clearedCount = 0;

  for (const table of tables) {
    if (!(await tableExists(conn, table))) continue;
    const count = await countRows(conn, table);
    totalRows += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, table);
      clearedCount++;
    } else if (dryRun && count > 0) {
      clearedCount++;
    }
  }

  return `Restaurant: ${dryRun ? "would clear" : "cleared"} ${totalRows} row(s) across ${clearedCount} table(s)`;
}

async function cleanupInventory(conn, dryRun) {
  const tables = [
    "inventory_chef_issues",
    "inventory_stock_ledger",
    "inventory_vendor_payments",
    "inventory_vendor_inwards",
    "inventory_transfers",
    "inventory_stock_audit",
    "inventory_purchase_orders",
    "inventory_waste_log",
  ];

  let totalRows = 0;
  let clearedCount = 0;

  for (const table of tables) {
    if (!(await tableExists(conn, table))) continue;
    const count = await countRows(conn, table);
    totalRows += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, table);
      clearedCount++;
    } else if (dryRun && count > 0) {
      clearedCount++;
    }
  }

  // Reset inventory stock to 0 (but keep the item master records)
  if (!dryRun && (await tableExists(conn, "inventory"))) {
    const invCount = await countRows(conn, "inventory");
    if (invCount > 0) {
      await conn.query("UPDATE inventory SET stock = 0");
      totalRows += invCount;
    }
  }

  return `Inventory: ${dryRun ? "would clear" : "cleared"} ~${totalRows} row(s) across ${clearedCount} table(s)${dryRun ? "" : " and reset stock to 0"}`;
}

async function cleanupBanquet(conn, dryRun) {
  if (!(await tableExists(conn, "banquet_bookings"))) {
    return "Banquet: banquet_bookings table not found – skipped";
  }

  const count = await countRows(conn, "banquet_bookings");

  if (!dryRun && count > 0) {
    await truncateTable(conn, "banquet_bookings");
  }

  return `Banquet: ${dryRun ? "would delete" : "deleted"} ${count} booking(s) (halls preserved)`;
}

async function cleanupAccounts(conn, dryRun) {
  let totalDeleted = 0;

  // accounts_transactions
  if (await tableExists(conn, "accounts_transactions")) {
    const count = await countRows(conn, "accounts_transactions");
    totalDeleted += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, "accounts_transactions");
    }
  }

  // vendor_payment_records (accounts mirror)
  if (await tableExists(conn, "vendor_payment_records")) {
    const count = await countRows(conn, "vendor_payment_records");
    totalDeleted += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, "vendor_payment_records");
    }
  }

  // purchase_orders (accounts mirror)
  if (await tableExists(conn, "purchase_orders")) {
    const count = await countRows(conn, "purchase_orders");
    totalDeleted += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, "purchase_orders");
    }
  }

  return `Accounts: ${dryRun ? "would clear" : "cleared"} ~${totalDeleted} row(s)`;
}

async function cleanupHousekeeping(conn, dryRun) {
  const tables = [
    "hk_room_costing",
    "hk_lost_found",
    "hk_inspections",
    "hk_amenities_consumption",
    "hk_messages",
    "hk_shift_roster",
    "housekeeping_logs",
    "housekeeping",
  ];

  let totalRows = 0;
  let clearedCount = 0;

  for (const table of tables) {
    if (!(await tableExists(conn, table))) continue;
    const count = await countRows(conn, table);
    totalRows += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, table);
      clearedCount++;
    } else if (dryRun && count > 0) {
      clearedCount++;
    }
  }

  return `Housekeeping: ${dryRun ? "would clear" : "cleared"} ~${totalRows} row(s) across ${clearedCount} table(s)`;
}

async function cleanupAttendance(conn, dryRun) {
  if (!(await tableExists(conn, "attendance_records"))) {
    return "Attendance: attendance_records table not found – skipped";
  }

  const count = await countRows(conn, "attendance_records");

  if (!dryRun && count > 0) {
    await truncateTable(conn, "attendance_records");
  }

  return `Attendance: ${dryRun ? "would delete" : "deleted"} ${count} record(s)`;
}

async function cleanupLogs(conn, dryRun) {
  let totalRows = 0;

  if (await tableExists(conn, "audit_logs")) {
    const count = await countRows(conn, "audit_logs");
    totalRows += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, "audit_logs");
    }
  }

  if (await tableExists(conn, "print_logs")) {
    const count = await countRows(conn, "print_logs");
    totalRows += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, "print_logs");
    }
  }

  if (await tableExists(conn, "print_queue")) {
    const count = await countRows(conn, "print_queue");
    totalRows += count;
    if (!dryRun && count > 0) {
      await truncateTable(conn, "print_queue");
    }
  }

  return `Logs: ${dryRun ? "would clear" : "cleared"} ~${totalRows} row(s)`;
}

const CLEANUP_FNS = {
  users: cleanupUsers,
  guests: cleanupGuests,
  restaurant: cleanupRestaurant,
  inventory: cleanupInventory,
  banquet: cleanupBanquet,
  accounts: cleanupAccounts,
  housekeeping: cleanupHousekeeping,
  attendance: cleanupAttendance,
  logs: cleanupLogs,
};

// ─── Main flow ────────────────────────────────────────────────────────────────

async function interactiveMenu(conn) {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║         Test Data Cleanup – Interactive          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  console.log("Available modules:\n");
  SUPPORTED_MODULES.forEach((mod, idx) => {
    console.log(`  [${idx + 1}] ${mod.padEnd(14)} – ${MODULE_DESCRIPTIONS[mod]}`);
  });
  console.log(`  [${SUPPORTED_MODULES.length + 1}] All of the above\n`);

  const answer = await ask(
    "Enter module numbers to clean (e.g. 1 3 5), or press Enter for all: "
  );

  let selected;
  if (!answer) {
    selected = new Set(SUPPORTED_MODULES);
  } else {
    selected = new Set();
    const indices = answer.split(/[\s,]+/).map(Number).filter((n) => n > 0);
    for (const idx of indices) {
      if (idx === SUPPORTED_MODULES.length + 1) {
        SUPPORTED_MODULES.forEach((m) => selected.add(m));
      } else if (idx <= SUPPORTED_MODULES.length) {
        selected.add(SUPPORTED_MODULES[idx - 1]);
      }
    }
  }

  if (selected.size === 0) {
    console.log("No modules selected. Exiting.");
    return;
  }

  console.log("\nModules selected:");
  for (const mod of selected) {
    console.log(`  • ${mod} – ${MODULE_DESCRIPTIONS[mod]}`);
  }

  const dbName = getDatabaseName();
  console.log(`\n⚠  Target database: ${dbName} (${getDbConnectionLabel()})`);

  const confirmAnswer = await ask(
    `\nType "${CONFIRM_PHRASE}" to confirm cleanup, or anything else to abort: `
  );

  if (confirmAnswer !== CONFIRM_PHRASE) {
    console.log("Aborted.");
    return;
  }

  console.log("\n── Dry run (preview) ──────────────────────────────");
  for (const mod of selected) {
    const msg = await CLEANUP_FNS[mod](conn, true);
    console.log(`  ${msg}`);
  }

  const dryRunConfirm = await ask(
    "\nProceed with actual deletion? (yes/no): "
  );
  if (!/^y(es)?$/i.test(dryRunConfirm)) {
    console.log("Aborted.");
    return;
  }

  console.log("\n── Cleaning ──────────────────────────────────────");
  for (const mod of selected) {
    try {
      const msg = await CLEANUP_FNS[mod](conn, false);
      console.log(`  ✔ ${msg}`);
    } catch (err) {
      console.error(`  ✖ ${mod} failed: ${err.message}`);
    }
  }

  console.log("\nCleanup complete.\n");
}

async function main() {
  const selected = parseArgs();

  if (selected.size === 0) {
    console.log(
      "Usage: node cleanupTestData.js [--all | --users --guests --restaurant --inventory --banquet --accounts --housekeeping --attendance --logs]"
    );
    console.log("\nOr run without arguments for the interactive menu.\n");
    process.exit(0);
  }

  console.log(`\n⚠  Target database: ${getDatabaseName()} (${getDbConnectionLabel()})`);
  console.log("⚠  This will PERMANENTLY DELETE data.\n");

  const confirmAnswer = await ask(
    `Type "${CONFIRM_PHRASE}" to confirm, or anything else to abort: `
  );

  if (confirmAnswer !== CONFIRM_PHRASE) {
    console.log("Aborted.");
    process.exit(0);
  }

  const connection = await mysql.createConnection({
    ...getDbBaseConfig(),
    database: getDatabaseName(),
    multipleStatements: true,
  });

  try {
    if (selected.has("all") || selected.size > 1) {
      // Dry run first when multiple modules
      console.log("\n── Dry run (preview) ──────────────────────────────");
      for (const mod of selected) {
        const msg = await CLEANUP_FNS[mod](connection, true);
        console.log(`  ${msg}`);
      }
      const proceed = await ask(
        "\nProceed with actual deletion? (yes/no): "
      );
      if (!/^y(es)?$/i.test(proceed)) {
        console.log("Aborted.");
        return;
      }
      console.log("\n── Cleaning ──────────────────────────────────────");
    }

    for (const mod of selected) {
      try {
        const msg = await CLEANUP_FNS[mod](connection, false);
        console.log(`  ✔ ${msg}`);
      } catch (err) {
        console.error(`  ✖ ${mod} failed: ${err.message}`);
      }
    }

    console.log("\nCleanup complete.\n");
  } finally {
    await connection.end();
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

(async () => {
  const selected = parseArgs();

  if (selected.size === 0) {
    // No CLI args – run interactive menu
    const connection = await mysql.createConnection({
      ...getDbBaseConfig(),
      database: getDatabaseName(),
      multipleStatements: true,
    });
    try {
      await interactiveMenu(connection);
    } finally {
      await connection.end();
    }
    return;
  }

  await main();
})();
