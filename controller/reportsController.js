const db = require("../config/db");

// Existing summary logic
exports.summary = (req, res) => {
  const queries = {
    totalRooms: "SELECT COUNT(*) as c FROM rooms",
    hotelBookings: "SELECT COUNT(*) as c FROM hotel_bookings",
    restaurantBills: "SELECT COUNT(*) as c FROM restaurant_bills",
    accountsTransactions: "SELECT COUNT(*) as c FROM accounts_transactions",
    banquetBookings: "SELECT COUNT(*) as c FROM banquet_bookings",
    attendanceRecords: "SELECT COUNT(*) as c FROM attendance",
  };

  const results = {};
  let pending = Object.keys(queries).length;
  let hasError = false;

  Object.entries(queries).forEach(([key, query]) => {
    db.query(query, (err, rows) => {
      if (hasError) return;

      if (err) {
        console.error(`Error executing query: ${key}`, err);
        hasError = true;
        return res.status(500).json({ message: "Error fetching report summary" });
      }

      results[key] = rows[0].c || 0;
      pending--;

      if (pending === 0 && !hasError) {
        res.json(results);
      }
    });
  });
};

exports.getReportData = (req, res) => {
  const { type, dateFrom, dateTo, status, hall, roomType, paymentMode } = req.query;

  if (!type) {
    return res.status(400).json({ message: "Report type required" });
  }

  let sql = "";
  let params = [];

  const addDateFilter = (column) => {
    if (dateFrom) {
      sql += ` AND DATE(${column}) >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND DATE(${column}) <= ?`;
      params.push(dateTo);
    }
  };

  if (type === "room") {
    sql = "SELECT id, DATE(check_in) as date, room_number as roomType, status, guest_name as guest, check_out as checkOut FROM hotel_bookings WHERE 1=1";
    addDateFilter("check_in");
    if (status && status !== "All") {
      sql += " AND status = ?"; params.push(status);
    }
    sql += " ORDER BY id DESC";
  } else if (type === "banquet") {
    sql = "SELECT id, date, hall_id as hall, status, event_type as eventType, guests, decoration_fee as decoration, discount, gst_percent as gstPercent FROM banquet_bookings WHERE 1=1";
    addDateFilter("date");
    if (status && status !== "All") {
      sql += " AND status = ?"; params.push(status);
    }
    if (hall && hall !== "All") {
      sql += " AND hall_id = ?"; params.push(hall);
    }
    sql += " ORDER BY id DESC";
  } else if (type === "restaurant") {
    sql = "SELECT id, DATE(created_at) as date, status, table_number as `table_number`, total as amount, payment_method as paymentMode FROM restaurant_bills WHERE 1=1";
    addDateFilter("created_at");
    if (paymentMode && paymentMode !== "All") {
      sql += " AND payment_method = ?"; params.push(paymentMode);
    }
    sql += " ORDER BY id DESC";
  } else if (type === "housekeeping") {
    sql = "SELECT id, room_number as roomType, status FROM rooms WHERE 1=1";
    if (status && status !== "All") {
      sql += " AND status = ?"; params.push(status);
    }
    sql += " ORDER BY room_number";
  } else if (type === "accounts") {
    sql = "SELECT id, date, type, description, amount, payment_mode as paymentMode FROM accounts_transactions WHERE 1=1";
    addDateFilter("date");
    if (paymentMode && paymentMode !== "All") {
      sql += " AND payment_mode = ?"; params.push(paymentMode);
    }
    sql += " ORDER BY date DESC, id DESC";
  } else {
    return res.json([]);
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error(`Error fetching ${type} report:`, err);
      return res.status(500).json({ message: "Failed to fetch report data" });
    }
    res.json(rows);
  });
};
