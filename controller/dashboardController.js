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

const detectDateColumn = async (table, candidates) => {
  for (const col of candidates) {
    const rows = await runQuery(
      `SHOW COLUMNS FROM ${table} WHERE Field = ?`,
      [col]
    );
    if (Array.isArray(rows) && rows.length > 0) return col;
  }
  return null;
};

const formatDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayKey = () => formatDateKey(new Date());

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

  // 1. Invoices generated today — authoritative billing (room + food + GST − discount)
  if (await tableExists("invoices")) {
    const dateColumn = await detectDateColumn("invoices", [
      "created_at", "createdAt", "date", "invoice_date", "invoiceDate",
      "generated_at", "generatedAt", "issued_at", "issuedAt", "bill_date", "billDate",
    ]);
    if (dateColumn) {
      const hasTotalAmount = await columnExists("invoices", "total_amount");
      const hasFinalTotal = await columnExists("invoices", "final_total");
      const amountCol = hasTotalAmount ? "total_amount" : hasFinalTotal ? "final_total" : null;

      if (amountCol) {
        total += await getTotal(`
          SELECT COALESCE(SUM(${amountCol}), 0) AS total
          FROM invoices
          WHERE DATE(${dateColumn}) = CURDATE()
            AND ${amountCol} > 0
        `);
      }
    }
  }

  // 2. Restaurant / shop sales today
  const salesSource = await resolveBillSource((createdColumn) =>
    `DATE(${createdColumn}) = CURDATE()`,
  );
  if (salesSource) {
    total += await getTotal(`
      SELECT COALESCE(SUM(${salesSource.totalColumn}), 0) AS total
      FROM ${salesSource.tableName}
      WHERE DATE(${salesSource.createdColumn}) = CURDATE()
        AND ${salesSource.totalColumn} IS NOT NULL
        AND ${salesSource.totalColumn} > 0
    `);
  }

  // 3. Banquet bookings happening today
  if (await tableExists("banquet_bookings") && await tableExists("banquet_halls")) {
    const hasStartTime = await columnExists("banquet_bookings", "start_time");
    const hasEventDate = await columnExists("banquet_bookings", "event_date");
    const hasCreatedAt = await columnExists("banquet_bookings", "created_at");

    if (hasStartTime) {
      total += await getTotal(`
        SELECT COALESCE(SUM(
          COALESCE(h.rate_per_hour, 0)
          * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time) / 60)))
          + COALESCE(b.decoration_fee, 0),
          0
        ) AS total
        FROM banquet_bookings b
        LEFT JOIN banquet_halls h ON h.id = b.hall_id
        WHERE DATE(b.start_time) = CURDATE()
      `);
    } else if (hasEventDate) {
      const hasRatePerHour = await columnExists("banquet_halls", "rate_per_hour");
      const hasRatePerHourCamel = await columnExists("banquet_halls", "ratePerHour");
      const rateCol = hasRatePerHour ? "rate_per_hour" : hasRatePerHourCamel ? "ratePerHour" : null;

      if (rateCol) {
        total += await getTotal(`
          SELECT COALESCE(SUM(
            COALESCE(h.${rateCol}, 0)
            * GREATEST(1, COALESCE(b.duration_hours, 1)))
            + COALESCE(b.decoration_fee, 0),
            0
          ) AS total
          FROM banquet_bookings b
          LEFT JOIN banquet_halls h ON h.id = b.hall_id
          WHERE DATE(b.event_date) = CURDATE()
        `);
      } else {
        total += await getTotal(`
          SELECT COALESCE(SUM(COALESCE(b.decoration_fee, 0)), 0) AS total
          FROM banquet_bookings b
          WHERE DATE(b.event_date) = CURDATE()
        `);
      }
    } else if (hasCreatedAt) {
      const hasRatePerHour = await columnExists("banquet_halls", "rate_per_hour");
      const hasRatePerHourCamel = await columnExists("banquet_halls", "ratePerHour");
      const rateCol = hasRatePerHour ? "rate_per_hour" : hasRatePerHourCamel ? "ratePerHour" : null;

      if (rateCol) {
        total += await getTotal(`
          SELECT COALESCE(SUM(
            COALESCE(h.${rateCol}, 0)
            * GREATEST(1, COALESCE(b.duration_hours, 1)))
            + COALESCE(b.decoration_fee, 0),
            0
          ) AS total
          FROM banquet_bookings b
          LEFT JOIN banquet_halls h ON h.id = b.hall_id
          WHERE DATE(b.created_at) = CURDATE()
        `);
      } else {
        total += await getTotal(`
          SELECT COALESCE(SUM(COALESCE(b.decoration_fee, 0)), 0) AS total
          FROM banquet_bookings b
          WHERE DATE(b.created_at) = CURDATE()
        `);
      }
    }
  }

  // 4. Hotel bookings with check-in today (room revenue for today)
  if (await tableExists("guests") && await tableExists("room_tariff")) {
    const hasCheckIn = await columnExists("guests", "check_in");
    const hasCheckInDate = await columnExists("guests", "check_in_date");

    if (hasCheckIn) {
      total += await getTotal(`
        SELECT COALESCE(SUM(rt.total), 0) AS total
        FROM guests g
        INNER JOIN room_tariff rt ON rt.booking_id = g.id
        WHERE DATE(g.check_in) = CURDATE()
          AND rt.total IS NOT NULL AND rt.total > 0
      `);
    } else if (hasCheckInDate) {
      total += await getTotal(`
        SELECT COALESCE(SUM(rt.total), 0) AS total
        FROM guests g
        INNER JOIN room_tariff rt ON rt.booking_id = g.id
        WHERE DATE(g.check_in_date) = CURDATE()
          AND rt.total IS NOT NULL AND rt.total > 0
      `);
    }
  }

  return total;
};

const getGuestStayRows = async () => {
  if (!(await tableExists("guests"))) return [];

  const hasRoomTariff = await tableExists("room_tariff");
  const roomJoin = hasRoomTariff
    ? `
      LEFT JOIN (
        SELECT
          booking_id,
          GROUP_CONCAT(DISTINCT CAST(room_number AS CHAR) ORDER BY room_number SEPARATOR ', ') AS rooms
        FROM room_tariff
        GROUP BY booking_id
      ) rt ON rt.booking_id = g.id
    `
    : "";
  const roomSelect = hasRoomTariff ? "COALESCE(rt.rooms, '') AS rooms," : "'' AS rooms,";

  const rows = await runQuery(`
    SELECT
      g.id,
      g.booking_code,
      g.guest_name,
      g.check_in,
      g.check_out,
      g.booking_status,
      ${roomSelect}
      g.mobile
    FROM guests g
    ${roomJoin}
    ORDER BY g.id DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    bookingId: row.id,
    bookingCode: row.booking_code || "",
    guestName: row.guest_name || "Guest",
    rooms: row.rooms || "",
    mobile: row.mobile || "",
    checkIn: formatDateKey(row.check_in),
    checkOut: formatDateKey(row.check_out),
    bookingStatus: row.booking_status || "Confirmed",
  }));
};

const isInactiveBooking = (booking) => {
  const status = String(booking.bookingStatus || "").toLowerCase();
  return status.includes("cancel") || status.includes("checked out");
};

const isCheckedInBooking = (booking) => {
  const status = String(booking.bookingStatus || "").toLowerCase();
  return status.includes("checked in") || status.includes("occupied") || status.includes("in house");
};

const getArrivalMetrics = async () => {
  const targetDate = todayKey();
  const bookings = await getGuestStayRows();

  const expectedArrivalDetails = bookings.filter(
    (booking) => booking.checkIn === targetDate && !isInactiveBooking(booking),
  );
  const expectedCheckoutDetails = bookings.filter(
    (booking) => booking.checkOut === targetDate && !isInactiveBooking(booking),
  );
  const todayCheckinDetails = bookings.filter(
    (booking) => booking.checkIn === targetDate && isCheckedInBooking(booking),
  );

  return {
    expectedArrivals: expectedArrivalDetails.length,
    expectedCheckouts: expectedCheckoutDetails.length,
    todayCheckins: todayCheckinDetails.length,
    expectedArrivalDetails,
    expectedCheckoutDetails,
    todayCheckinDetails,
  };
};

const getTotalRevenueGenerated = async () => {
  let total = 0;

  // 1. Invoices — authoritative billing totals (room + food + GST − discount)
  if (await tableExists("invoices")) {
    const hasTotalAmount = await columnExists("invoices", "total_amount");
    const hasFinalTotal = await columnExists("invoices", "final_total");
    if (hasTotalAmount) {
      total += await getTotal(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM invoices
        WHERE total_amount > 0
      `);
    } else if (hasFinalTotal) {
      total += await getTotal(`
        SELECT COALESCE(SUM(final_total), 0) AS total
        FROM invoices
        WHERE final_total > 0
      `);
    }
  }

  // 2. Hotel bookings via guests + room_tariff (only bookings NOT already
  //    covered by an invoice to avoid double-counting)
  if (await tableExists("guests") && await tableExists("room_tariff")) {
    const hasInvoices = await tableExists("invoices");
    let excludeClause = "";
    let params = [];

    if (hasInvoices) {
      const invoiceBookingRows = await runQuery(
        "SELECT DISTINCT booking_id FROM invoices WHERE booking_id IS NOT NULL AND booking_id > 0",
      );
      const invoiceIds = invoiceBookingRows
        .map((r) => Number(r.booking_id))
        .filter(Boolean);
      if (invoiceIds.length > 0) {
        const placeholders = invoiceIds.map(() => "?").join(",");
        excludeClause = `AND g.id NOT IN (${placeholders})`;
        params = invoiceIds;
      }
    }

    total += await getTotal(
      `
      SELECT COALESCE(SUM(rt.total), 0) AS total
      FROM guests g
      INNER JOIN room_tariff rt ON rt.booking_id = g.id
      WHERE rt.total IS NOT NULL AND rt.total > 0
      ${excludeClause}
    `,
      params,
    );
  }

  // 3. Restaurant bills
  const salesSource = await resolveBillSource(() => "1 = 1");
  if (salesSource) {
    total += await getTotal(`
      SELECT COALESCE(SUM(${salesSource.totalColumn}), 0) AS total
      FROM ${salesSource.tableName}
      WHERE ${salesSource.totalColumn} IS NOT NULL AND ${salesSource.totalColumn} > 0
    `);
  }

  // 4. Banquet bookings — rate × hours + decoration fee
  if (await tableExists("banquet_bookings") && await tableExists("banquet_halls")) {
    const hasRatePerHour = await columnExists("banquet_halls", "rate_per_hour");
    const hasRatePerHourCamel = await columnExists("banquet_halls", "ratePerHour");
    if (hasRatePerHour || hasRatePerHourCamel) {
      const rateCol = hasRatePerHour ? "rate_per_hour" : "ratePerHour";
      total += await getTotal(`
        SELECT COALESCE(SUM(
          COALESCE(h.${rateCol}, 0)
          * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time) / 60)))
          + COALESCE(b.decoration_fee, 0),
          0
        ) AS total
        FROM banquet_bookings b
        LEFT JOIN banquet_halls h ON h.id = b.hall_id
      `);
    } else {
      total += await getTotal(`
        SELECT COALESCE(SUM(COALESCE(b.decoration_fee, 0)), 0) AS total
        FROM banquet_bookings b
      `);
    }
  }

  return total;
};

exports.getMetrics = async (_req, res) => {
  try {
    const [
      totalRooms,
      occupiedRooms,
      todayRevenue,
      totalRevenueGenerated,
      arrivalMetrics,
    ] =
      await Promise.all([
        getTotalRooms(),
        getOccupiedRooms(),
        getTodayRevenue(),
        getTotalRevenueGenerated(),
        getArrivalMetrics(),
      ]);

    res.json({
      totalRooms,
      occupiedRooms,
      todayRevenue,
      todayCheckins: arrivalMetrics.todayCheckins,
      expectedArrivals: arrivalMetrics.expectedArrivals,
      expectedCheckouts: arrivalMetrics.expectedCheckouts,
      totalRevenueGenerated,
      expectedArrivalDetails: arrivalMetrics.expectedArrivalDetails,
      expectedCheckoutDetails: arrivalMetrics.expectedCheckoutDetails,
      todayCheckinDetails: arrivalMetrics.todayCheckinDetails,
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
