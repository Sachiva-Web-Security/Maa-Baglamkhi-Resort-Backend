require("dotenv").config({ quiet: process.env.NODE_ENV === "test" });
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const db = require("./config/db");
const {
  ensureSchema: ensureHotelRoomInventorySchema,
} = require("./models/hotelRoomInventoryModel");
const {
  ensureSchema: ensureGuestSchema,
} = require("./models/guestModel");
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
} = require("./models/PaymentModel");
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
const auditLogger = require("./middleware/auditLogger");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

global.io = io;

io.on("connection", () => {
  console.log("User connected");
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auditLogger);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/hotel", require("./routes/bookingRoutes"));
app.use("/api/restaurant", require("./routes/restaurantRoutes"));
app.use("/api/room-service", require("./routes/roomServiceRoutes"));
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
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/audit-logs", require("./routes/auditLogRoutes"));
app.use("/api/housekeeping", require("./routes/housekeepingRoutes"));

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

async function initializeDatabase() {
  try {
    await db.promise().query("SELECT 1");
    if (process.env.NODE_ENV !== "test") {
      console.log("MySQL Connected");
    }

    await bootstrapSchema("Housekeeping schema init", ensureHousekeepingSchema);
    await bootstrapSchema("Hotel room inventory schema init", ensureHotelRoomInventorySchema);
    await bootstrapSchema("Guest schema init", ensureGuestSchema);
    await bootstrapSchema("Company schema init", ensureCompanySchema);
    await bootstrapSchema("Pax schema init", ensurePaxSchema);
    await bootstrapSchema("Room tariff schema init", ensureRoomTariffSchema);
    await bootstrapSchema("Advance payment schema init", ensureAdvancePaymentSchema);
    await bootstrapSchema("Payment history schema init", ensurePaymentHistorySchema);
    await bootstrapSchema("Payments schema init", ensurePaymentSchema);
    await bootstrapSchema("Accounts schema init", ensureAccountsSchema);
    await bootstrapSchema("Attendance schema init", ensureAttendanceSchema);
    await bootstrapSchema("Banquet schema init", ensureBanquetSchema);
    await bootstrapSchema("Room service schema init", ensureRoomServiceSchema);
    await bootstrapSchema("Token schema init", ensureTokenSchema);
    await bootstrapSchema("Restaurant schema init", ensureRestaurantSchema);
    await bootstrapSchema("Kitchen schema init", ensureKitchenSchema);
    await bootstrapSchema("Audit log schema init", ensureAuditLogSchema);
    await bootstrapSchema("Completed cleaning log schema init", ensureCompletedCleaningLogSchema);
    await bootstrapSchema("Accounts expansion schema init", ensureAccountsExpansionSchema);
  } catch (error) {
    console.error("Database connection failed:", error.code || error.message || error);
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
