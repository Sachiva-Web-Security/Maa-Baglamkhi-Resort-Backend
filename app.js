
require("dotenv").config({ quiet: process.env.NODE_ENV === "test" });
const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

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
  const {
    ensureSchema: ensureHotelInfoSchema,
  } = require("./models/hotelInfoModel");
  const {
    ensureSchema: ensureFinancialYearSchema,
  } = require("./models/financialYearModel");
  const {
    ensureSchema: ensureIdTypeSchema,
  } = require("./models/idTypeModel");
  const {
    ensureSchema: ensureTaxCategorySchema,
  } = require("./models/taxCategoryModel");
  const {
    ensureSchema: ensureTaxSettingSchema,
  } = require("./models/taxSettingModel");
  const {
    ensureSchema: ensureManageUserSchema,
  } = require("./models/manageUserModel");
  const {
    ensureSchema: ensurePaymentModeSchema,
  } = require("./models/paymentModeModel");
  const {
    ensureSchema: ensureGuestMasterSchema,
  } = require("./models/guestMasterModel");
  const {
    ensureSchema: ensureEmployeeSchema,
  } = require("./models/employeeModel");
  const {
    ensureSchema: ensureTerminalSchema,
  } = require("./models/terminalModel");
  const {
    ensureSchema: ensurePrinterLocationSchema,
  } = require("./models/printerLocationModel");
  const {
    ensureSchema: ensureBranchSchema,
  } = require("./models/branchModel");
  const {
    ensureSchema: ensureEmailConfigSchema,
  } = require("./models/emailConfigModel");
  const {
    ensureSchema: ensureAccessRuleSchema,
  } = require("./models/accessRuleModel");
  const {
    ensureSchema: ensurePrepaidCardSchema,
  } = require("./models/prepaidCardModel");
  const {
    ensureSchema: ensureDiscountCouponSchema,
  } = require("./models/discountCouponModel");
  const {
    ensureSchema: ensureRoomTypeSchema,
  } = require("./models/roomTypeModel");
  const {
    ensureSchema: ensureFoRoomSchema,
  } = require("./models/foRoomModel");
  const {
    ensureSchema: ensureFoServiceSchema,
  } = require("./models/foServiceModel");
  const {
    ensureSchema: ensureFoSettingsSchema,
  } = require("./models/foSettingsModel");
  const {
    ensureSchema: ensureFbInvoiceGroupSchema,
  } = require("./models/fbInvoiceGroupModel");
  const {
    ensureSchema: ensureFbPriceGroupSchema,
  } = require("./models/fbPriceGroupModel");
  const {
    ensureSchema: ensureFbPrintGroupSchema,
  } = require("./models/fbPrintGroupModel");
  const {
    ensureSchema: ensureFbItemGroupSchema,
  } = require("./models/fbItemGroupModel");
  const {
    ensureSchema: ensureFbUnitSchema,
  } = require("./models/fbUnitModel");
  const {
    ensureSchema: ensureFbItemSchema,
  } = require("./models/fbItemModel");
  const {
    ensureSchema: ensureFbTableGroupSchema,
  } = require("./models/fbTableGroupModel");
  const {
    ensureSchema: ensureFbTableSchema,
  } = require("./models/fbTableModel");
  const {
    ensureSchema: ensureFbParcelSettingSchema,
  } = require("./models/fbParcelSettingModel");
  const {
    ensureSchema: ensureFbCaptainSchema,
  } = require("./models/fbCaptainModel");
  const {
    ensureSchema: ensureFbInvoiceSchema,
  } = require("./models/fbInvoiceModel");
  const {
    ensureSchema: ensureFbRoomServiceSettingsSchema,
  } = require("./models/fbRoomServiceSettingsModel");
  const {
    ensureSchema: ensureFbModifierSchema,
  } = require("./models/fbModifierModel");
  const {
    ensureSchema: ensureFbBarToFoodSchema,
  } = require("./models/fbBarToFoodModel");
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
app.use("/api/inventory-masters", require("./routes/inventoryMastersRoutes"));
app.use("/api/menu-recipes", require("./routes/menuRecipeRoutes"));
app.use("/api/audit-logs", require("./routes/auditLogRoutes"));
app.use("/api/housekeeping", require("./routes/housekeepingRoutes"));
app.use("/api/hotel-info", require("./routes/hotelInfoRoutes"));
app.use("/api/financial-year", require("./routes/financialYearRoutes"));
app.use("/api/id-types", require("./routes/idTypeRoutes"));
app.use("/api/tax-categories", require("./routes/taxCategoryRoutes"));
app.use("/api/tax-settings", require("./routes/taxSettingRoutes"));
app.use("/api/manage-users", require("./routes/manageUserRoutes"));
app.use("/api/payment-modes", require("./routes/paymentModeRoutes"));
app.use("/api/guest-master", require("./routes/guestMasterRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/terminals", require("./routes/terminalRoutes"));
app.use("/api/printer-locations", require("./routes/printerLocationRoutes"));
app.use("/api/branches", require("./routes/branchRoutes"));
app.use("/api/email-config", require("./routes/emailConfigRoutes"));
app.use("/api/access-rules", require("./routes/accessRuleRoutes"));
app.use("/api/prepaid-cards", require("./routes/prepaidCardRoutes"));
app.use("/api/discount-coupons", require("./routes/discountCouponRoutes"));
app.use("/api/room-types", require("./routes/roomTypeRoutes"));
app.use("/api/fo-rooms", require("./routes/foRoomRoutes"));
app.use("/api/fo-services", require("./routes/foServiceRoutes"));
app.use("/api/fo-settings", require("./routes/foSettingsRoutes"));
app.use("/api/fb-invoice-groups", require("./routes/fbInvoiceGroupRoutes"));
app.use("/api/fb-price-groups", require("./routes/fbPriceGroupRoutes"));
app.use("/api/fb-print-groups", require("./routes/fbPrintGroupRoutes"));
app.use("/api/fb-item-groups", require("./routes/fbItemGroupRoutes"));
app.use("/api/fb-units", require("./routes/fbUnitRoutes"));
app.use("/api/fb-items", require("./routes/fbItemRoutes"));
app.use("/api/fb-table-groups", require("./routes/fbTableGroupRoutes"));
app.use("/api/fb-tables", require("./routes/fbTableRoutes"));
app.use("/api/fb-parcel-settings", require("./routes/fbParcelSettingRoutes"));
app.use("/api/fb-captains", require("./routes/fbCaptainRoutes"));
app.use("/api/fb-invoices", require("./routes/fbInvoiceRoutes"));
app.use("/api/fb-room-service-settings", require("./routes/fbRoomServiceSettingsRoutes"));
app.use("/api/fb-modifiers", require("./routes/fbModifierRoutes"));
app.use("/api/fb-bar-to-food", require("./routes/fbBarToFoodRoutes"));

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
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS register (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
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
    await bootstrapSchema("Kitchen schema init", ensureKitchenSchema);
    await bootstrapSchema("Audit log schema init", ensureAuditLogSchema);
    await bootstrapSchema("Completed cleaning log schema init", ensureCompletedCleaningLogSchema);
    await bootstrapSchema("Accounts expansion schema init", ensureAccountsExpansionSchema);
    await bootstrapSchema("Inventory masters schema init", ensureInventoryMastersSchema);
    await bootstrapSchema("Menu recipe schema init", ensureMenuRecipeSchema);
    await bootstrapSchema("Hotel info schema init", ensureHotelInfoSchema);
    await bootstrapSchema("Financial year schema init", ensureFinancialYearSchema);
    await bootstrapSchema("ID type schema init", ensureIdTypeSchema);
    await bootstrapSchema("Tax category schema init", ensureTaxCategorySchema);
    await bootstrapSchema("Tax setting schema init", ensureTaxSettingSchema);
    await bootstrapSchema("Default staff login bootstrap", ensureDefaultStaffLogins);
    await bootstrapSchema("Manage users schema init", ensureManageUserSchema);
    await bootstrapSchema("Payment modes schema init", ensurePaymentModeSchema);
    await bootstrapSchema("Guest master schema init", ensureGuestMasterSchema);
    await bootstrapSchema("Employees schema init", ensureEmployeeSchema);
    await bootstrapSchema("Terminals schema init", ensureTerminalSchema);
    await bootstrapSchema("Printer locations schema init", ensurePrinterLocationSchema);
    await bootstrapSchema("Branches schema init", ensureBranchSchema);
    await bootstrapSchema("Email config schema init", ensureEmailConfigSchema);
    await bootstrapSchema("Access rules schema init", ensureAccessRuleSchema);
    await bootstrapSchema("Prepaid cards schema init", ensurePrepaidCardSchema);
    await bootstrapSchema("Discount coupons schema init", ensureDiscountCouponSchema);
    await bootstrapSchema("Room types schema init", ensureRoomTypeSchema);
    await bootstrapSchema("FO rooms schema init", ensureFoRoomSchema);
    await bootstrapSchema("FO services schema init", ensureFoServiceSchema);
    await bootstrapSchema("FO settings schema init", ensureFoSettingsSchema);
    await bootstrapSchema("FB invoice groups schema init", ensureFbInvoiceGroupSchema);
    await bootstrapSchema("FB price groups schema init", ensureFbPriceGroupSchema);
    await bootstrapSchema("FB print groups schema init", ensureFbPrintGroupSchema);
    await bootstrapSchema("FB item groups schema init", ensureFbItemGroupSchema);
    await bootstrapSchema("FB units schema init", ensureFbUnitSchema);
    await bootstrapSchema("FB items schema init", ensureFbItemSchema);
    await bootstrapSchema("FB table groups schema init", ensureFbTableGroupSchema);
    await bootstrapSchema("FB tables schema init", ensureFbTableSchema);
    await bootstrapSchema("FB parcel settings schema init", ensureFbParcelSettingSchema);
    await bootstrapSchema("FB captains schema init", ensureFbCaptainSchema);
    await bootstrapSchema("FB invoices schema init", ensureFbInvoiceSchema);
    await bootstrapSchema("FB room service settings schema init", ensureFbRoomServiceSettingsSchema);
    await bootstrapSchema("FB modifiers schema init", ensureFbModifierSchema);
    await bootstrapSchema("FB bar-to-food schema init", ensureFbBarToFoodSchema);
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
