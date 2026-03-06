const db = require("../config/db");

const tableExists = (tableName, cb) => {
  db.query("SHOW TABLES LIKE ?", [tableName], (err, rows) => {
    if (err) return cb(err);
    cb(null, Array.isArray(rows) && rows.length > 0);
  });
};

const columnExists = (tableName, columnName, cb) => {
  db.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName], (err, rows) => {
    if (err) return cb(err);
    cb(null, Array.isArray(rows) && rows.length > 0);
  });
};

// Existing summary logic
exports.summary = (req, res) => {
  const results = {};

  const tasks = [
    { key: "totalRooms", sql: "SELECT COUNT(*) as c FROM rooms" },
    { key: "hotelBookings", sql: "SELECT COUNT(*) as c FROM hotel_bookings" },
    { key: "accountsTransactions", sql: "SELECT COUNT(*) as c FROM accounts_transactions" },
    { key: "banquetBookings", sql: "SELECT COUNT(*) as c FROM banquet_bookings" },
    // restaurant bills: prefer restaurant_bills, fallback to bills
    {
      key: "restaurantBills",
      choose: (done) => {
        tableExists("restaurant_bills", (e, ok) => {
          if (e) return done(e);
          done(null, ok ? "restaurant_bills" : "bills");
        });
      },
      makeSql: (table) => `SELECT COUNT(*) as c FROM \`${table}\``,
    },
    // attendance: prefer attendance, fallback to attendance_records
    {
      key: "attendanceRecords",
      choose: (done) => {
        tableExists("attendance", (e, ok) => {
          if (e) return done(e);
          done(null, ok ? "attendance" : "attendance_records");
        });
      },
      makeSql: (table) => `SELECT COUNT(*) as c FROM \`${table}\``,
    },
  ];

  let pending = tasks.length;
  let hasError = false;

  const finishOne = () => {
    pending--;
    if (pending === 0 && !hasError) res.json(results);
  };

  tasks.forEach((t) => {
    if (t.sql) {
      db.query(t.sql, (err, rows) => {
        if (hasError) return;
        if (err) {
          console.error(`Error executing query: ${t.key}`, err);
          hasError = true;
          return res.status(500).json({ message: "Error fetching report summary" });
        }
        results[t.key] = rows?.[0]?.c || 0;
        finishOne();
      });
      return;
    }

    t.choose((chooseErr, table) => {
      if (hasError) return;
      if (chooseErr) {
        console.error(`Error checking table for query: ${t.key}`, chooseErr);
        hasError = true;
        return res.status(500).json({ message: "Error fetching report summary" });
      }

      const sql = t.makeSql(table);
      db.query(sql, (err, rows) => {
        if (hasError) return;
        if (err) {
          console.error(`Error executing query: ${t.key}`, err);
          hasError = true;
          return res.status(500).json({ message: "Error fetching report summary" });
        }
        results[t.key] = rows?.[0]?.c || 0;
        finishOne();
      });
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
    // Support both schemas:
    // - restaurant_bills(created_at, table_number, total, payment_method, status)
    // - bills(tableNumber, subtotal, gst, total, paymentMethod, [created_at?])
    tableExists("restaurant_bills", (tblErr, hasRestaurantBills) => {
      if (tblErr) {
        console.error("Error checking restaurant tables:", tblErr);
        return res.status(500).json({ message: "Failed to fetch report data" });
      }

      if (hasRestaurantBills) {
        sql =
          "SELECT id, DATE(created_at) as date, status, table_number as `table_number`, total as amount, payment_method as paymentMode FROM restaurant_bills WHERE 1=1";
        addDateFilter("created_at");
        if (paymentMode && paymentMode !== "All") {
          sql += " AND payment_method = ?"; params.push(paymentMode);
        }
        sql += " ORDER BY id DESC";

        return db.query(sql, params, (err, rows) => {
          if (err) {
            console.error("Error fetching restaurant report:", err);
            return res.status(500).json({ message: "Failed to fetch report data" });
          }
          return res.json(rows);
        });
      }

      // Fallback to `bills`
      columnExists("bills", "created_at", (colErr, hasCreatedAt) => {
        if (colErr) {
          console.error("Error checking bills columns:", colErr);
          return res.status(500).json({ message: "Failed to fetch report data" });
        }

        sql =
          `SELECT id, ${hasCreatedAt ? "DATE(created_at)" : "NULL"} as date, ` +
          "tableNumber as `table_number`, total as amount, paymentMethod as paymentMode FROM bills WHERE 1=1";

        if (hasCreatedAt) {
          addDateFilter("created_at");
        }
        if (paymentMode && paymentMode !== "All") {
          sql += " AND paymentMethod = ?"; params.push(paymentMode);
        }
        sql += " ORDER BY id DESC";

        db.query(sql, params, (err, rows) => {
          if (err) {
            console.error("Error fetching bills report:", err);
            return res.status(500).json({ message: "Failed to fetch report data" });
          }
          return res.json(rows);
        });
      });
    });
    return;
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
