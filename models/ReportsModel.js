const db = require("../config/db");

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

const tableExists = (tableName) => {
  return new Promise((resolve, reject) => {
    db.query("SHOW TABLES LIKE ?", [tableName], (err, rows) => {
      if (err) return reject(err);
      resolve(Array.isArray(rows) && rows.length > 0);
    });
  });
};

const columnExists = (tableName, columnName) => {
  return new Promise((resolve, reject) => {
    db.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName], (err, rows) => {
      if (err) return reject(err);
      resolve(Array.isArray(rows) && rows.length > 0);
    });
  });
};

const toISODate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
};

const normalizePaymentMode = (value) => {
  if (!value) return "N/A";
  const v = String(value).trim().toLowerCase();
  if (v === "cash") return "Cash";
  if (v === "card") return "Card";
  if (v === "upi") return "UPI";
  if (v === "bank transfer" || v === "bank_transfer" || v === "bank") return "Bank Transfer";
  return String(value);
};

const withDateRange = (rows, dateFrom, dateTo) => {
  return rows.filter((row) => {
    const date = row.date || row.billDate;
    if (!date) return false;
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  });
};

const withCommonFilters = (rows, { status, hall, roomType, paymentMode }) => {
  return rows.filter((row) => {
    if (status && status !== "All" && row.status && row.status !== status) return false;
    if (hall && hall !== "All" && row.hall && row.hall !== hall) return false;
    if (roomType && roomType !== "All" && row.roomType && row.roomType !== roomType) return false;
    if (paymentMode && paymentMode !== "All" && row.paymentMode && row.paymentMode !== paymentMode) return false;
    return true;
  });
};

const getAllBillsRows = async ({ dateFrom, dateTo, status, paymentMode }) => {
  const rows = [];

  const hasRestaurantBills = await tableExists("restaurant_bills");
  const restaurantTable = hasRestaurantBills ? "restaurant_bills" : "bills";
  const restaurantHasStatus = await columnExists(restaurantTable, "status");
  const restaurantHasCreatedAt = await columnExists(restaurantTable, "created_at");

  const restaurantSql = hasRestaurantBills
    ? `SELECT id, DATE(created_at) AS billDate, COALESCE(total, 0) AS amount, payment_method AS paymentMode, ${restaurantHasStatus ? "status" : "'Paid'"} AS status FROM restaurant_bills`
    : `SELECT id, ${restaurantHasCreatedAt ? "DATE(created_at)" : "NULL"} AS billDate, COALESCE(total, 0) AS amount, paymentMethod AS paymentMode, 'Paid' AS status FROM bills`;

  const restaurantRows = await runQuery(restaurantSql);
  restaurantRows.forEach((r) => {
    rows.push({
      id: `restaurant-${r.id}`,
      date: toISODate(r.billDate),
      source: "Restaurant",
      billNo: `RES-${String(r.id).padStart(6, "0")}`,
      description: "Restaurant bill",
      amount: Number(r.amount) || 0,
      paymentMode: normalizePaymentMode(r.paymentMode),
      status: r.status || "Paid",
      type: "Income",
    });
  });

  const hotelRows = await runQuery(
    `SELECT id, DATE(check_out) AS billDate, guest_name, room_number, status, bill_generated, 
      COALESCE(price_per_day, 0) * GREATEST(1, DATEDIFF(COALESCE(check_out, check_in), check_in)) AS amount
     FROM hotel_bookings`
  );
  hotelRows
    .filter((r) => Number(r.bill_generated) === 1 || Number(r.amount) > 0)
    .forEach((r) => {
      rows.push({
        id: `hotel-${r.id}`,
        date: toISODate(r.billDate),
        source: "Hotel",
        billNo: `HOT-${String(r.id).padStart(6, "0")}`,
        description: `${r.guest_name || "Guest"} / Room ${r.room_number || "-"}`,
        amount: Number(r.amount) || 0,
        paymentMode: "N/A",
        status: r.status || "Billed",
        type: "Income",
      });
    });

  const banquetRows = await runQuery(
    `SELECT b.id, DATE(b.date) AS billDate, COALESCE(h.name, CONCAT('Hall #', b.hall_id)) AS hall, b.status,
      COALESCE(
        (COALESCE(h.rate_per_hour, 0) * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time) / 60)))
        + COALESCE(b.decoration_fee, 0),
        COALESCE(b.decoration_fee, 0)
      ) AS amount
     FROM banquet_bookings b
     LEFT JOIN banquet_halls h ON h.id = b.hall_id`
  );
  banquetRows.forEach((r) => {
    rows.push({
      id: `banquet-${r.id}`,
      date: toISODate(r.billDate),
      source: "Banquet",
      billNo: `BNQ-${String(r.id).padStart(6, "0")}`,
      description: `${r.hall || "Banquet hall"} booking`,
      amount: Number(r.amount) || 0,
      paymentMode: "N/A",
      status: r.status || "Billed",
      type: "Income",
    });
  });

  const accountsRows = await runQuery(
    "SELECT id, DATE(date) AS billDate, type, description, amount, payment_mode AS paymentMode FROM accounts_transactions"
  );
  accountsRows.forEach((r) => {
    rows.push({
      id: `accounts-${r.id}`,
      date: toISODate(r.billDate),
      source: "Accounts",
      billNo: `ACC-${String(r.id).padStart(6, "0")}`,
      description: r.description || "Accounts transaction",
      amount: Number(r.amount) || 0,
      paymentMode: normalizePaymentMode(r.paymentMode),
      status: "Posted",
      type: r.type || "Income",
    });
  });

  let filtered = withDateRange(rows, dateFrom, dateTo);
  filtered = withCommonFilters(filtered, { status, hall: "All", roomType: "All", paymentMode });
  filtered.sort((a, b) => {
    if (a.date === b.date) return String(a.id).localeCompare(String(b.id));
    return a.date < b.date ? 1 : -1;
  });
  return filtered;
};

// Fetch summary counts
const getSummaryCounts = async () => {
  const results = {};

  const tasks = [
    { key: "totalRooms", sql: "SELECT COUNT(*) as c FROM rooms" },
    { key: "hotelBookings", sql: "SELECT COUNT(*) as c FROM hotel_bookings" },
    { key: "accountsTransactions", sql: "SELECT COUNT(*) as c FROM accounts_transactions" },
    { key: "banquetBookings", sql: "SELECT COUNT(*) as c FROM banquet_bookings" },
    {
      key: "restaurantBills",
      choose: async () => {
        const exists = await tableExists("restaurant_bills");
        return exists ? "restaurant_bills" : "bills";
      },
      makeSql: (table) => `SELECT COUNT(*) as c FROM \`${table}\``,
    },
    {
      key: "attendanceRecords",
      choose: async () => {
        const exists = await tableExists("attendance");
        return exists ? "attendance" : "attendance_records";
      },
      makeSql: (table) => `SELECT COUNT(*) as c FROM \`${table}\``,
    },
  ];

  for (const t of tasks) {
    if (t.sql) {
      const rows = await runQuery(t.sql);
      results[t.key] = rows?.[0]?.c || 0;
      continue;
    }

    const table = await t.choose();
    const sql = t.makeSql(table);
    const rows = await runQuery(sql);
    results[t.key] = rows?.[0]?.c || 0;
  }

  return results;
};

// Fetch report data
const getReportData = async ({ type, dateFrom, dateTo, status, hall, roomType, paymentMode }) => {
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
    sql = `SELECT id, DATE(check_in) as date, room_number as roomType, status, guest_name as guest, check_out as checkOut,
      COALESCE(price_per_day, 0) * GREATEST(1, DATEDIFF(COALESCE(check_out, check_in), check_in)) as revenue,
      'N/A' as paymentMode
      FROM hotel_bookings WHERE 1=1`;
    addDateFilter("check_in");
    if (status && status !== "All") { sql += " AND status = ?"; params.push(status); }
    if (roomType && roomType !== "All") { sql += " AND room_number = ?"; params.push(roomType); }
    sql += " ORDER BY id DESC";

  } else if (type === "banquet") {
    sql = `SELECT b.id, DATE(b.date) as date, COALESCE(h.name, CONCAT('Hall #', b.hall_id)) as hall, b.status, b.event_type as eventType, b.guests,
      COALESCE(
        (COALESCE(h.rate_per_hour, 0) * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time) / 60)))
        + COALESCE(b.decoration_fee, 0),
        COALESCE(b.decoration_fee, 0)
      ) as amount,
      'N/A' as paymentMode
      FROM banquet_bookings b
      LEFT JOIN banquet_halls h ON h.id = b.hall_id
      WHERE 1=1`;
    addDateFilter("date");
    if (status && status !== "All") { sql += " AND status = ?"; params.push(status); }
    if (hall && hall !== "All") { sql += " AND h.name = ?"; params.push(hall); }
    if (paymentMode && paymentMode !== "All") { sql += " AND 1=0"; }
    sql += " ORDER BY b.id DESC";

  } else if (type === "restaurant") {
    const hasRestaurantBills = await tableExists("restaurant_bills");
    if (hasRestaurantBills) {
      sql =
        "SELECT id, DATE(created_at) as date, status, table_number as `table_number`, total as amount, payment_method as paymentMode FROM restaurant_bills WHERE 1=1";
      addDateFilter("created_at");
      if (paymentMode && paymentMode !== "All") { sql += " AND payment_method = ?"; params.push(paymentMode); }
      sql += " ORDER BY id DESC";
    } else {
      const hasCreatedAt = await columnExists("bills", "created_at");
      sql = `SELECT id, ${hasCreatedAt ? "DATE(created_at)" : "NULL"} as date, tableNumber as table_number, total as amount, paymentMethod as paymentMode FROM bills WHERE 1=1`;
      if (hasCreatedAt) addDateFilter("created_at");
      if (paymentMode && paymentMode !== "All") { sql += " AND paymentMethod = ?"; params.push(paymentMode); }
      sql += " ORDER BY id DESC";
    }

  } else if (type === "housekeeping") {
    sql = "SELECT id, DATE(COALESCE(check_in, NOW())) as date, room_number as roomType, status, guest as assignee, 1 as rooms FROM rooms WHERE 1=1";
    if (status && status !== "All") { sql += " AND status = ?"; params.push(status); }
    if (roomType && roomType !== "All") { sql += " AND room_number = ?"; params.push(roomType); }
    sql += " ORDER BY room_number";

  } else if (type === "accounts") {
    sql = "SELECT id, DATE(date) as date, type, description, amount, payment_mode as paymentMode, 'Posted' as status FROM accounts_transactions WHERE 1=1";
    addDateFilter("date");
    if (paymentMode && paymentMode !== "All") { sql += " AND payment_mode = ?"; params.push(paymentMode); }
    sql += " ORDER BY date DESC, id DESC";

  } else if (type === "all-bills") {
    return getAllBillsRows({ dateFrom, dateTo, status, paymentMode });
  } else {
    return [];
  }

  const rows = await runQuery(sql, params);
  return rows.map((row) => ({
    ...row,
    date: toISODate(row.date),
    paymentMode: row.paymentMode ? normalizePaymentMode(row.paymentMode) : row.paymentMode,
  }));
};

module.exports = { getSummaryCounts, getReportData, tableExists, columnExists };
