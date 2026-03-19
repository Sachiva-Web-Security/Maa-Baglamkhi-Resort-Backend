require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./config/db");
const {
  ensureSchema: ensureHotelRoomInventorySchema,
} = require("./models/hotelRoomInventoryModel");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// SOCKET
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

global.io = io;

io.on("connection", (socket) => {
  console.log("User connected");
});

// ================= MIDDLEWARE =================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// ================= ROUTES =================

// Auth
app.use("/api/auth", require("./routes/authRoutes"));

// Users
app.use("/api/users", require("./routes/userRoutes"));

// Hotel
app.use("/api/hotel", require("./routes/bookingRoutes"));

// Restaurant
app.use("/api/restaurant", require("./routes/restaurantRoutes"));

// Room Service (uses restaurant POS style flow)
app.use("/api/room-service", require("./routes/roomServiceRoutes"));

// Accounts
app.use("/api/accounts", require("./routes/accountsRoutes"));

// Banquet


// Attendance
app.use("/api/attendance", require("./routes/attendanceRoutes"));

// Reports
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/report", require("./routes/reportRoutes"));

// Assignment
app.use("/api/assignments", require("./routes/assignmentRoute"));

// Dashboard
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// Token
app.use("/api/token", require("./routes/tokenRoutes"));

// Payment
app.use("/api/payment", require("./routes/paymentRoutes"));

// Invoice
const invoiceRoutes = require("./routes/InvoiceRoutes");
app.use("/api/invoices", invoiceRoutes);

// Kitchen
const kitchenRoutes = require("./routes/kitchenRoutes");
app.use("/api/kitchen", kitchenRoutes);

// Inventory
const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/api/inventory", inventoryRoutes);

// Housekeeping
app.use("/api/housekeeping", require("./routes/housekeepingRoutes"));


// ================= HEALTH CHECK =================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is reachable",
  });
});


// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {
  if (!err) return next();

  console.error("Unhandled error:", err);

  res.status(500).json({
    message: "Internal server error",
  });
});


// ================= TEST ROUTE =================

app.get("/", (req, res) => {
  res.send("Backend Running 🚀");
});


// ================= SERVER =================

const PORT = process.env.PORT || 5002;

ensureHotelRoomInventorySchema().catch((error) => {
  console.error("Hotel room inventory schema init failed:", error);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// ================= GRACEFUL SHUTDOWN =================

function shutdown(signal) {
  try {
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 2000).unref();
  } catch (e) {
    process.exit(0);
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGUSR2", () => shutdown("SIGUSR2"));
