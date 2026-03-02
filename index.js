require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./config/db");

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

// ROUTES
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/hotel", require("./routes/hotelRoutes"));
app.use("/api/restaurant", require("./routes/restaurantRoutes"));
app.use("/api/accounts", require("./routes/accountsRoutes"));
app.use("/api/banquet", require("./routes/banquetRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/assignments", require("./routes/assignmentRoute"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
const invoiceRoutes = require("./routes/InvoiceRoutes");
app.use("/api/invoices", invoiceRoutes);
const kitchenRoutes = require("./routes/kitchenRoutes");
app.use("/api/kitchen", kitchenRoutes);
// TEST
app.get("/", (req, res) => {
  res.send("Backend Running 🚀");
})





const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});