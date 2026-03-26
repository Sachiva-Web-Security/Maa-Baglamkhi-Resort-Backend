const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const tableExists = async (tableName) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows.length > 0;
};

const getCount = async (sql, params = []) => {
  const rows = await runQuery(sql, params);
  return Number(rows?.[0]?.count || 0);
};

const getTotal = async (sql, params = []) => {
  const rows = await runQuery(sql, params);
  return Number(rows?.[0]?.total || 0);
};

const resolveBillSource = async (rangeConditionBuilder) => {
  const candidates = ["restaurant_bills", "bills"];
  let fallback = null;

  for (const tableName of candidates) {
    if (!(await tableExists(tableName))) continue;

    const totalColumn = (await columnExists(tableName, "total")) ? "total" : "subtotal";
    const createdColumn = (await columnExists(tableName, "created_at")) ? "created_at" : "date";
    const source = { tableName, totalColumn, createdColumn };
    if (!fallback) fallback = source;

    const countRows = await runQuery(`
      SELECT COUNT(*) AS count
      FROM ${tableName}
      WHERE ${rangeConditionBuilder(createdColumn)}
    `);

    if (Number(countRows?.[0]?.count || 0) > 0) {
      return source;
    }
  }

  return fallback;
};

const resolveRoomSource = async () => {
  if (await tableExists("hotel_room_inventory")) return "hotel_room_inventory";
  if (await tableExists("rooms")) return "rooms";
  return "";
};

const classifyRoomStatus = (value) => {
  const status = String(value || "").toLowerCase();
  if (status.includes("occupied") || status.includes("checked in") || status.includes("in house")) {
    return "Occupied";
  }
  if (status.includes("cleaning") || status.includes("dirty")) {
    return "Cleaning";
  }
  if (status.includes("blocked") || status.includes("maintenance") || status.includes("out of service")) {
    return "Maintenance";
  }
  return "Available";
};

const getTotalRooms = async () => {
  const sourceTable = await resolveRoomSource();
  if (!sourceTable) return 0;
  return getCount(`SELECT COUNT(*) AS count FROM ${sourceTable}`);
};

const getOccupiedRooms = async () => {
  const sourceTable = await resolveRoomSource();
  if (!sourceTable) return 0;

  const rows = await runQuery(`SELECT COALESCE(status, 'Available') AS status FROM ${sourceTable}`);
  return rows.reduce(
    (count, row) => count + (classifyRoomStatus(row.status) === "Occupied" ? 1 : 0),
    0,
  );
};

const getTodayRevenue = async () => {
  let total = 0;

  if (await tableExists("accounts_transactions")) {
    total += await getTotal(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM accounts_transactions
      WHERE LOWER(COALESCE(type, '')) = 'income'
        AND DATE(date) = CURDATE()
    `);
  }

  if (total > 0) {
    return total;
  }

  const salesSource = await resolveBillSource((createdColumn) => `DATE(${createdColumn}) = CURDATE()`);
  if (salesSource) {
    return getTotal(`
      SELECT COALESCE(SUM(${salesSource.totalColumn}), 0) AS total
      FROM ${salesSource.tableName}
      WHERE DATE(${salesSource.createdColumn}) = CURDATE()
    `);
  }

  return total;
};

const getTodayCheckins = async () => {
  if (await tableExists("guests")) {
    return getCount(
      "SELECT COUNT(*) AS count FROM guests WHERE DATE(check_in) = CURDATE()",
    );
  }

  if (await tableExists("hotel_bookings")) {
    return getCount(
      "SELECT COUNT(*) AS count FROM hotel_bookings WHERE DATE(check_in) = CURDATE()",
    );
  }

  return 0;
};

exports.getMetrics = async (_req, res) => {
  try {
    const [totalRooms, occupiedRooms, todayRevenue, todayCheckins] =
      await Promise.all([
        getTotalRooms(),
        getOccupiedRooms(),
        getTodayRevenue(),
        getTodayCheckins(),
      ]);

    res.json({
      totalRooms,
      occupiedRooms,
      todayRevenue,
      todayCheckins,
    });
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    res.status(500).json({ message: "Error fetching metrics" });
  }
};

const getMonthlyRevenueChart = async () => {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      name: date.toLocaleDateString("en-IN", { month: "short" }),
      Online: 0,
      Offline: 0,
    };
  });

  const monthMap = new Map(months.map((item) => [item.key, item]));

  if (await tableExists("guests") && await tableExists("room_tariff")) {
    const hotelRows = await runQuery(`
      SELECT
        DATE_FORMAT(g.check_in, '%Y-%m') AS monthKey,
        COALESCE(SUM(rt.total), 0) AS total
      FROM guests g
      LEFT JOIN room_tariff rt ON rt.booking_id = g.id
      WHERE g.check_in >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
        AND LOWER(COALESCE(g.booking_status, 'confirmed')) NOT IN ('cancelled')
      GROUP BY DATE_FORMAT(g.check_in, '%Y-%m')
    `);

    hotelRows.forEach((row) => {
      const target = monthMap.get(String(row.monthKey || ""));
      if (target) target.Online = Number(row.total || 0);
    });
  }

  const salesSource = await resolveBillSource(
    (createdColumn) =>
      `${createdColumn} >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)`,
  );
  if (salesSource) {
    const restaurantRows = await runQuery(`
      SELECT
        DATE_FORMAT(${salesSource.createdColumn}, '%Y-%m') AS monthKey,
        COALESCE(SUM(${salesSource.totalColumn}), 0) AS total
      FROM ${salesSource.tableName}
      WHERE ${salesSource.createdColumn} >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
      GROUP BY DATE_FORMAT(${salesSource.createdColumn}, '%Y-%m')
    `);

    restaurantRows.forEach((row) => {
      const target = monthMap.get(String(row.monthKey || ""));
      if (target) target.Offline = Number(row.total || 0);
    });
  }

  return months;
};

const getRoomOccupancyChart = async () => {
  const base = [
    { name: "Occupied", value: 0 },
    { name: "Available", value: 0 },
    { name: "Cleaning", value: 0 },
    { name: "Maintenance", value: 0 },
  ];
  const bucketMap = new Map(base.map((item) => [item.name, item]));

  const sourceTable = await resolveRoomSource();
  if (!sourceTable) return base;

  const rows = await runQuery(`SELECT COALESCE(status, 'Available') AS status FROM ${sourceTable}`);
  rows.forEach((row) => {
    const bucket = classifyRoomStatus(row.status);
    bucketMap.get(bucket).value += 1;
  });

  return Array.from(bucketMap.values());
};

const getFoodSalesChart = async () => {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      key: date.toISOString().slice(0, 10),
      name: date.toLocaleDateString("en-IN", { weekday: "short" }),
      value: 0,
    };
  });
  const dayMap = new Map(days.map((item) => [item.key, item]));

  const salesSource = await resolveBillSource(
    (createdColumn) => `DATE(${createdColumn}) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)`,
  );
  if (!salesSource) return days;

  const rows = await runQuery(`
    SELECT
      DATE(${salesSource.createdColumn}) AS dayKey,
      COALESCE(SUM(${salesSource.totalColumn}), 0) AS total
    FROM ${salesSource.tableName}
    WHERE DATE(${salesSource.createdColumn}) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(${salesSource.createdColumn})
    ORDER BY DATE(${salesSource.createdColumn})
  `);

  rows.forEach((row) => {
    const key = row.dayKey instanceof Date
      ? row.dayKey.toISOString().slice(0, 10)
      : String(row.dayKey || "").slice(0, 10);
    const target = dayMap.get(key);
    if (target) target.value = Number(row.total || 0);
  });

  return days;
};

exports.getCharts = async (_req, res) => {
  try {
    const [monthlyRevenue, roomOccupancy, foodSales] = await Promise.all([
      getMonthlyRevenueChart(),
      getRoomOccupancyChart(),
      getFoodSalesChart(),
    ]);

    res.json({
      monthlyRevenue,
      roomOccupancy,
      foodSales,
    });
  } catch (error) {
    console.error("Error fetching dashboard charts:", error);
    res.status(500).json({ message: "Error fetching dashboard charts" });
  }
};
