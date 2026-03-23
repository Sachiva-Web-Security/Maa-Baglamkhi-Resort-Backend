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

const getCount = async (sql, params = []) => {
  const rows = await runQuery(sql, params);
  return Number(rows?.[0]?.count || 0);
};

const getTotal = async (sql, params = []) => {
  const rows = await runQuery(sql, params);
  return Number(rows?.[0]?.total || 0);
};

const getTotalRooms = async () => {
  if (await tableExists("rooms")) {
    return getCount("SELECT COUNT(*) AS count FROM rooms");
  }

  if (await tableExists("hotel_room_inventory")) {
    return getCount("SELECT COUNT(*) AS count FROM hotel_room_inventory");
  }

  return 0;
};

const getOccupiedRooms = async () => {
  if (!(await tableExists("rooms"))) {
    return 0;
  }

  return getCount(`
    SELECT COUNT(*) AS count
    FROM rooms
    WHERE LOWER(COALESCE(status, '')) = 'occupied'
       OR (
            check_in IS NOT NULL
        AND DATE(check_in) <= CURDATE()
        AND (check_out IS NULL OR DATE(check_out) >= CURDATE())
       )
  `);
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

  if (await tableExists("restaurant_bills")) {
    return getTotal(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM restaurant_bills
      WHERE DATE(created_at) = CURDATE()
    `);
  }

  if (await tableExists("bills")) {
    return getTotal(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM bills
      WHERE DATE(created_at) = CURDATE()
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

exports.getCharts = (req, res) => {
  const data = {
    monthlyRevenue: [
      { name: "Jan", Online: 4000, Offline: 2400 },
      { name: "Feb", Online: 3000, Offline: 1398 },
      { name: "Mar", Online: 2000, Offline: 9800 },
      { name: "Apr", Online: 2780, Offline: 3908 },
      { name: "May", Online: 1890, Offline: 4800 },
      { name: "Jun", Online: 2390, Offline: 3800 },
      { name: "Jul", Online: 3490, Offline: 4300 },
    ],
    roomOccupancy: [
      { name: "Occupied", value: 85 },
      { name: "Available", value: 20 },
      { name: "Cleaning", value: 10 },
      { name: "Maintenance", value: 5 },
    ],
    foodSales: [
      { name: "Main Course", value: 45 },
      { name: "Starters", value: 25 },
      { name: "Beverages", value: 15 },
      { name: "Desserts", value: 15 },
    ],
  };

  db.query(
    "SELECT status, COUNT(*) as count FROM rooms GROUP BY status",
    (err, rows) => {
      if (!err && rows && rows.length > 0) {
        data.roomOccupancy = rows.map((r) => ({
          name: r.status,
          value: r.count,
        }));
      }
      res.json(data);
    },
  );
};
