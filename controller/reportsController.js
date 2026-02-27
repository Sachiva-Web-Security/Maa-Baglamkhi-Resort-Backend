const db = require("../config/db");

exports.summary = (req, res) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM rooms) AS totalRooms,
      (SELECT COUNT(*) FROM hotel_bookings) AS hotelBookings,
      (SELECT COUNT(*) FROM restaurant_bills) AS restaurantBills,
      (SELECT COUNT(*) FROM accounts_transactions) AS accountsTransactions,
      (SELECT COUNT(*) FROM banquet_bookings) AS banquetBookings,
      (SELECT COUNT(*) FROM attendance_records) AS attendanceRecords
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching report summary:", err);
      return res.status(500).json({ message: "Error fetching summary" });
    }
    res.json(rows[0]);
  });
};

