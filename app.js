require("dotenv").config({ quiet: process.env.NODE_ENV === "test" });
const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");

const db = require("./config/db");
const { getDbConnectionLabel } = require("./config/databaseConfig");
const {
  ensureSchema: ensureHotelRoomInventorySchema,
} = require("./models/hotelRoomInventoryModel");
const {
  ensureSchema: ensureGuestSchema,
} = require("./models/guestModel");
const {
  ensureSchema: ensureGuestDocumentSchema,
} = require("./models/guestDocumentModel");
const {
  ensureSchema: ensureOtherBookingSchema,
} = require("./models/otherBookingModel");
const {
  ensureSchema: ensureReferenceNotesSchema,
} = require("./models/referenceModel");
const {
  ensureSchema: ensureAdvancePaymentSchema,
} = require("./models/advanceModel");
const {
  ensureSchema: ensureAccountsSchema,
} = require("./models/AccountsModel");
const {
  ensureSchema: ensureAttendanceSchema,
} = require("./models/AttendanceModel");
const {
  ensureSchema: ensureBanquetSchema,
} = require("./models/BanquetModel");
const {
  ensureSchema: ensureCompanySchema,
} = require("./models/companyModel");
const {
  ensureSchema: ensurePaymentHistorySchema,
} = require("./models/Paymentadvance");
const {
  ensureSchema: ensurePaxSchema,
} = require("./models/paxModel");
const {
  ensureSchema: ensurePaymentSchema,
} = require("./models/paymentModel");
const {
  ensureSchema: ensureRoomServiceSchema,
} = require("./models/RoomServiceModel");
const {
  ensureSchema: ensureRoomTariffSchema,
} = require("./models/roomTariffModel");
const {
  ensureSchema: ensureTokenSchema,
} = require("./models/TokenModel");
const {
  ensureSchema: ensureRestaurantSchema,
  bootstrapLegacyBills,
} = require("./models/RestaurantModel");
const {
  ensureSchema: ensureKitchenSchema,
} = require("./models/kitchen");
const {
  ensureSchema: ensureHousekeepingSchema,
} = require("./models/Housekeeping");
const {
  ensureSchema: ensureAuditLogSchema,
} = require("./models/AuditLogModel");
const {
  ensureSchema: ensureCompletedCleaningLogSchema,
} = require("./models/CompletedCleaningLogModel");
const {
  ensureSchema: ensureAccountsExpansionSchema,
} = require("./models/AccountsExpansionModel");
const {
  ensureSchema: ensureInventoryMastersSchema,
} = require("./models/InventoryMastersModel");
const {
  ensureSchema: ensureMenuRecipeSchema,
} = require("./models/MenuRecipeModel");
const auditLogger = require("./middleware/auditLogger");
const { getCorsOptions } = require("./config/security");

const app = express();
const server = http.createServer(app);
const corsOptions = getCorsOptions();

const io = new Server(server, {
  cors: corsOptions,
});

global.io = io;

app.disable("etag");

io.on("connection", () => {
  console.log("User connected");
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
app.use(auditLogger);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/hotel", require("./routes/bookingRoutes"));
app.use("/api/restaurant", require("./routes/restaurantRoutes"));
app.use("/api/room-service", require("./routes/roomServiceRoutes"));
app.use("/api/waiter", require("./routes/waiterRoutes"));
app.use("/api/accounts", require("./routes/accountsRoutes"));
app.use("/api/banquet", require("./routes/banquetRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/report", require("./routes/reportRoutes"));
app.use("/api/assignments", require("./routes/assignmentRoute"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/token", require("./routes/tokenRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));




const invoiceRoutes = require("./routes/InvoiceRoutes");
app.use("/api/invoices", invoiceRoutes);
app.use("/api/invoice", invoiceRoutes);

app.use("/api/kitchen", require("./routes/kitchenRoutes"));
app.use("/api/chef", require("./routes/chefRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/inventory-masters", require("./routes/inventoryMastersRoutes"));
app.use("/api/menu-recipes", require("./routes/menuRecipeRoutes"));
app.use("/api/audit-logs", require("./routes/auditLogRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/housekeeping", require("./routes/housekeepingRoutes"));
app.use("/api/salary", require("./routes/salaryRoutes"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is reachable",
  });
});

app.use((err, req, res, next) => {
  if (!err) return next();

  console.error("Unhandled error:", err);

  res.status(500).json({
    message: "Internal server error",
  });
});

app.get("/", (req, res) => {
  res.send("Backend Running");
});

async function bootstrapSchema(label, task) {
  try {
    await task();
  } catch (error) {
    console.error(`${label} failed:`, error.message || error);
  }
}

async function ensureDefaultStaffLogins() {
  // ── Ensure register table has a `phone` column (for WhatsApp invoice sending) ──
  try {
    await db.promise().query(
      "ALTER TABLE register ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL AFTER email"
    );
  } catch (e) {
    // MySQL < 8.0 doesn't support ADD COLUMN IF NOT EXISTS; try the legacy form
    try {
      const [[{ COUNT }]] = await db.promise().query(
        "SELECT COUNT(*) AS COUNT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'register' AND COLUMN_NAME = 'phone'"
      );
      if (!COUNT) {
        await db.promise().query("ALTER TABLE register ADD COLUMN phone VARCHAR(20) DEFAULT NULL AFTER email");
      }
    } catch (alterErr) {
      console.warn("Could not add `phone` column to register table:", alterErr.message);
    }
  }

  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS register (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      phone VARCHAR(20) DEFAULT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'staff',
      avatar_url VARCHAR(255) DEFAULT NULL
    )
  `);

  const hashedPassword = await bcrypt.hash("password", 10);
  const defaultUsers = [
    ["Admin User", "admin@resort.com", "admin"],
    ["Rajesh Manager", "manager@resort.com", "manager"],
    ["Priya Reception", "reception@resort.com", "receptionist"],
    ["CA Accounts", "accounts@resort.com", "accountant"],
    ["Tarun HK", "tarun@resort.com", "housekeeping"],
    ["Ramu Waiter", "waiter@resort.com", "waiter"],
    ["Chef Kumar", "kitchen@resort.com", "kitchen"],
  ];

  for (const [name, email, role] of defaultUsers) {
    const [existingRows] = await db.promise().query(
      "SELECT id FROM register WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [email],
    );

    if (existingRows.length > 0) {
      continue;
    }

    await db.promise().query(
      "INSERT INTO register (name, email, password, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, role],
    );
  }
}

async function initializeDatabase(options = {}) {
  try {
    const skipPaymentSchema =
      options.skipPaymentSchema === true ||
      String(process.env.SKIP_PAYMENT_SCHEMA_BOOTSTRAP || "").toLowerCase() === "true";

    await db.promise().query("SELECT 1");
    if (process.env.NODE_ENV !== "test") {
      console.log("MySQL Connected");
    }

    await bootstrapSchema("Housekeeping schema init", ensureHousekeepingSchema);
    await bootstrapSchema("Hotel room inventory schema init", ensureHotelRoomInventorySchema);
    await bootstrapSchema("Guest schema init", ensureGuestSchema);
    await bootstrapSchema("Guest documents schema init", ensureGuestDocumentSchema);
    await bootstrapSchema("Other booking schema init", ensureOtherBookingSchema);
    await bootstrapSchema("Reference notes schema init", ensureReferenceNotesSchema);
    await bootstrapSchema("Company schema init", ensureCompanySchema);
    await bootstrapSchema("Pax schema init", ensurePaxSchema);
    await bootstrapSchema("Room tariff schema init", ensureRoomTariffSchema);
    await bootstrapSchema("Advance payment schema init", ensureAdvancePaymentSchema);
    await bootstrapSchema("Payment history schema init", ensurePaymentHistorySchema);
    if (!skipPaymentSchema) {
      await bootstrapSchema("Payments schema init", ensurePaymentSchema);
    }
    await bootstrapSchema("Accounts schema init", ensureAccountsSchema);
    await bootstrapSchema("Attendance schema init", ensureAttendanceSchema);
    await bootstrapSchema("Banquet schema init", ensureBanquetSchema);
    await bootstrapSchema("Room service schema init", ensureRoomServiceSchema);
    await bootstrapSchema("Token schema init", ensureTokenSchema);
    await bootstrapSchema("Restaurant schema init", ensureRestaurantSchema);
    // One-time migration: sync legacy restaurant_bills from bills. Runs once
    // on startup after the schema is in place — never per-request.
    try {
      await bootstrapLegacyBills();
    } catch (err) {
      console.error("Legacy bill sync bootstrap failed:", err.message);
    }
    await bootstrapSchema("Kitchen schema init", ensureKitchenSchema);
    await bootstrapSchema("Audit log schema init", ensureAuditLogSchema);
    await bootstrapSchema("Completed cleaning log schema init", ensureCompletedCleaningLogSchema);
    await bootstrapSchema("Accounts expansion schema init", ensureAccountsExpansionSchema);
    await bootstrapSchema("Inventory masters schema init", ensureInventoryMastersSchema);
    await bootstrapSchema("Menu recipe schema init", ensureMenuRecipeSchema);
    await bootstrapSchema("Default staff login bootstrap", ensureDefaultStaffLogins);
  } catch (error) {
    console.error(
      `Database connection failed (${getDbConnectionLabel()}):`,
      error.code || error.message || error,
    );
    console.error("Skipping schema bootstrap until MySQL is available.");
  }
}

function shutdown() {
  try {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  } catch (error) {
    process.exit(0);
  }
}

module.exports = {
  app,
  server,
  io,
  initializeDatabase,
  shutdown,
};
