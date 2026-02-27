const BanquetModel = require("../models/BanquetModel");

exports.getHallsAndBookings = (req, res) => {
  BanquetModel.getHalls((err, halls) => {
    if (err) {
      console.error("Error fetching halls:", err);
      return res.status(500).json({ message: "Error fetching halls" });
    }
    BanquetModel.getBookings((err2, bookings) => {
      if (err2) {
        console.error("Error fetching bookings:", err2);
        return res.status(500).json({ message: "Error fetching bookings" });
      }
      res.json({ halls, bookings });
    });
  });
};

exports.createBooking = (req, res) => {
  const data = req.body;
  if (!data.hallId || !data.customerName || !data.phone || !data.date) {
    return res.status(400).json({ message: "Missing fields" });
  }
  BanquetModel.createBooking(data, (err, result) => {
    if (err) {
      console.error("Error creating banquet booking:", err);
      return res.status(500).json({ message: "Error creating booking" });
    }
    res.json({ message: "Booking created", id: result.insertId });
  });
};

exports.completeBooking = (req, res) => {
  const { id } = req.params;
  BanquetModel.markCompleted(id, (err) => {
    if (err) {
      console.error("Error marking completed:", err);
      return res.status(500).json({ message: "Error updating booking" });
    }
    res.json({ message: "Marked completed" });
  });
};

exports.billBooking = (req, res) => {
  const { id } = req.params;
  const { invoiceNo } = req.body;
  const inv = invoiceNo || `BNQ-${String(id).padStart(6, "0")}`;
  BanquetModel.markBilled(id, inv, (err) => {
    if (err) {
      console.error("Error marking billed:", err);
      return res.status(500).json({ message: "Error updating booking" });
    }
    res.json({ message: "Marked billed", invoiceNo: inv });
  });
};

