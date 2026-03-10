require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./config/db");
const authMiddleware = require("./middleware/authMiddleware");

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

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// Public: serve uploaded files (avatars, etc.)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ROUTES (public – no auth)
app.use("/api/auth", require("./routes/authRoutes"));

// Protected routes – require valid JWT
app.use("/api/users", authMiddleware, require("./routes/userRoutes"));
app.use("/api/hotel", authMiddleware, require("./routes/hotelRoutes"));
app.use("/api/restaurant", authMiddleware, require("./routes/restaurantRoutes"));
app.use("/api/accounts", authMiddleware, require("./routes/accountsRoutes"));
app.use("/api/banquet", authMiddleware, require("./routes/banquetRoutes"));
app.use("/api/attendance", authMiddleware, require("./routes/attendanceRoutes"));
app.use("/api/reports", authMiddleware, require("./routes/reportsRoutes"));
app.use("/api/assignments", authMiddleware, require("./routes/assignmentRoute"));
app.use("/api/dashboard", authMiddleware, require("./routes/dashboardRoutes"));
const invoiceRoutes = require("./routes/InvoiceRoutes");
app.use("/api/invoices", authMiddleware, invoiceRoutes);
const kitchenRoutes = require("./routes/kitchenRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/api/inventory", authMiddleware, inventoryRoutes);

app.use("/api/kitchen", authMiddleware, kitchenRoutes);
app.use("/api/housekeeping", authMiddleware, require("./routes/housekeepingRoutes"));
// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is reachable" });
});

// Error handler (e.g., Multer file size/type errors)
// Must be after routes.
app.use((err, req, res, next) => {
  if (!err) return next();

  // Multer errors: https://github.com/expressjs/multer#error-handling
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "File too large. Max 10MB allowed." });
    }
    return res.status(400).json({ message: err.message || "Upload error" });
  }

  // Multer fileFilter errors (not MulterError)
  if (typeof err.message === "string" && err.message.includes("images allowed")) {
    return res.status(400).json({ message: err.message });
  }

  // Generic fallback
  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Internal server error" });
});

// TEST
app.get("/", (req, res) => {
  res.send("Backend Running 🚀");
})





const PORT = process.env.PORT || 5002;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown (helps avoid EADDRINUSE on nodemon restarts on Windows)
function shutdown(signal) {
  try {
    server.close(() => {
      process.exit(0);
    });
    // Force-exit if close hangs
    setTimeout(() => process.exit(0), 2000).unref();
  } catch (e) {
    process.exit(0);
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
// nodemon restart signal
process.once("SIGUSR2", () => shutdown("SIGUSR2"));