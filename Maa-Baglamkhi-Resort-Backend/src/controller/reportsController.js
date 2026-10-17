const db = require("../config/db");

const tableExists = async (tableName) => {
  // Information_schema instead of SHOW: mysql2's query() returns SHOW output as
  // two result sets, which is also Array(2), so rows.length there is the number
  // of result sets — 2 whether the table exists or not, and this check went
  // permanently true for every table. execute() cannot be used either: this
  // server rejects `SHOW TABLES LIKE ?` with ER_PARSE_ERROR.
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [tableName],
  );
  return Array.isArray(rows) && rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  // Identifiers cannot be bound as placeholders, so interpolate with escaping.
  // Binding the column name made mysql2 send `LIKE ?`, which this server
  // rejects with ER_PARSE_ERROR — every columnExists call failed, so every
  // schema-drift guard in this controller was dead.
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
    [tableName, columnName],
  );
  return Array.isArray(rows) && rows.length > 0;
};

const columnMapCache = new Map();
// Returns { column_name: true, ... } for a table, so a query can be built from
// whichever columns actually exist instead of assuming the legacy camelCase names.
const getColumnMap = async (tableName) => {
  if (!columnMapCache.has(tableName)) {
    columnMapCache.set(
      tableName,
      (async () => {
        const map = {};
        // information_schema, not SHOW COLUMNS: query() returns SHOW output as
        // two result sets, so the tuple destructures to the array of result
        // sets and this map came back empty for every table. With an empty map
        // every column guard in this controller decided "column missing",
        // which is how the room report joined room_categories without ever
        // checking it existed.
        const [rows] = await db.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
          [tableName],
        );
        (Array.isArray(rows) ? rows : []).forEach((row) => {
          map[row.column_name] = true;
        });
        return map;
      })(),
    );
  }
  return columnMapCache.get(tableName);
};

let banquetHallRateColumnPromise = null;
const getBanquetHallRateColumn = async () => {
  if (!banquetHallRateColumnPromise) {
    banquetHallRateColumnPromise = (async () => {
      const snake = await columnExists("banquet_halls", "rate_per_hour");
      if (snake) return "rate_per_hour";

      const camel = await columnExists("banquet_halls", "ratePerHour");
      if (camel) return "ratePerHour";

      return null;
    })();
  }

  return banquetHallRateColumnPromise;
};

let restaurantBillsColumnMapPromise = null;
const getRestaurantBillsColumnMap = async () => {
  if (!restaurantBillsColumnMapPromise) {
    restaurantBillsColumnMapPromise = (async () => {
      const hasRestaurantBills = await tableExists("restaurant_bills");
      if (!hasRestaurantBills) return null;

      const [
        hasStatus,
        hasInvoiceStatus,
        hasPaymentMethodSnake,
        hasPaymentMethodCamel,
        hasTableNumberSnake,
        hasTableNumberCamel,
      ] = await Promise.all([
        columnExists("restaurant_bills", "status"),
        columnExists("restaurant_bills", "invoiceStatus"),
        columnExists("restaurant_bills", "payment_method"),
        columnExists("restaurant_bills", "paymentMethod"),
        columnExists("restaurant_bills", "table_number"),
        columnExists("restaurant_bills", "tableNumber"),
      ]);

      return {
        status: hasStatus ? "status" : hasInvoiceStatus ? "invoiceStatus" : null,
        paymentMethod: hasPaymentMethodSnake ? "payment_method" : hasPaymentMethodCamel ? "paymentMethod" : null,
        tableNumber: hasTableNumberSnake ? "table_number" : hasTableNumberCamel ? "tableNumber" : null,
      };
    })();
  }

  return restaurantBillsColumnMapPromise;
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
  const restaurantColumns = hasRestaurantBills ? await getRestaurantBillsColumnMap() : null;
  const restaurantHasCreatedAt = await columnExists(restaurantTable, "created_at");
  const billColumns = hasRestaurantBills ? null : await getColumnMap("bills");

  // restaurant_bills has no payment_method column, so emit an empty literal
  // (normalizePaymentMode turns that into "N/A") when getRestaurantBillsColumnMap
  // reports none. A bare `NULL AS paymentMode` resolves against the outer column
  // set and errors with ER_BAD_FIELD_ERROR on this server.
  const restaurantSql = hasRestaurantBills
    ? `SELECT id, DATE(created_at) AS billDate, COALESCE(total, 0) AS amount, '${
        restaurantColumns?.paymentMethod || ""
      }' AS paymentMode, ${
        restaurantColumns?.status || "'Paid'"
      } AS status FROM restaurant_bills`
    : `SELECT id, ${restaurantHasCreatedAt ? "DATE(created_at)" : "NULL"} AS billDate, COALESCE(total, 0) AS amount, ` +
      `${billColumns?.payment_method ? "payment_method" : "NULL"} AS paymentMode, ` +
      `${billColumns?.payment_status ? "COALESCE(payment_status, 'Paid')" : "'Paid'"} AS status FROM bills`;

  const [restaurantRows] = await db.query(restaurantSql);
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

  // bookings has no guest_name or booking_status. Guest names live on
  // booking_rooms (one row per room in the stay) and total_amount on bookings
  // itself. room_tariff has no room_number, so the real room number comes
  // through rooms via booking_rooms.room_id.
  const [hotelRows] = await db.query(
    `SELECT
      b.id,
      DATE(COALESCE(b.check_out, b.check_in)) AS billDate,
      b.status AS bookingStatus,
      COALESCE(NULLIF(SUM(rt.total), 0), COALESCE(b.total_amount, 0)) AS amount,
      GROUP_CONCAT(DISTINCT NULLIF(br.guest_name, '')) AS guests,
      GROUP_CONCAT(DISTINCT r.room_number ORDER BY r.room_number) AS rooms
     FROM bookings b
     LEFT JOIN room_tariff rt ON b.id = rt.booking_id
     LEFT JOIN booking_rooms br ON br.booking_id = b.id
     LEFT JOIN rooms r ON r.id = br.room_id
     GROUP BY b.id, b.status, b.total_amount, b.check_in, b.check_out`
  );
  hotelRows
    .filter((r) => Number(r.amount) > 0)
    .forEach((r) => {
      rows.push({
        id: `hotel-${r.id}`,
        date: toISODate(r.billDate),
        source: "Hotel",
        billNo: `HOT-${String(r.id).padStart(6, "0")}`,
        description: `${r.guests || "Guest"} / Room ${r.rooms || "-"}`,
        amount: Number(r.amount) || 0,
        paymentMode: "N/A",
        status: r.bookingStatus || "Billed",
        type: "Income",
      });
    });

  const banquetHallRateColumn = await getBanquetHallRateColumn();
  const banquetRateExpr = banquetHallRateColumn
    ? `COALESCE(h.${banquetHallRateColumn}, 0)`
    : "0";
  const [banquetRows] = await db.query(
    `SELECT b.id, DATE(b.date) AS billDate, COALESCE(h.name, CONCAT('Hall #', b.hall_id)) AS hall, b.status,
      COALESCE(
        ((${banquetRateExpr}) * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time) / 60)))
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

  const [accountsRows] = await db.query(
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

exports.summary = async (req, res) => {
  try {
    const safeCount = async (sql, params = []) => {
      try {
        const [rows] = await db.query(sql, params);
        return rows?.[0]?.c || 0;
      } catch (err) {
        console.warn(`[reports/summary] skipped count for "${sql}": ${err.code || err.message}`);
        return 0;
      }
    };

    const pickTable = async (candidates) => {
      for (const name of candidates) {
        try {
          const exists = await tableExists(name);
          if (exists) return name;
        } catch (err) {
          // ignore — keep trying
        }
      }
      return null;
    };

    const [
      totalRoomsTable,
      hotelBookingsTable,
      restaurantTable,
      attendanceTable,
    ] = await Promise.all([
      pickTable(["hotel_room_inventory", "housekeeping", "rooms"]),
      pickTable(["bookings", "hotel_bookings"]),
      pickTable(["restaurant_bills", "bills"]),
      pickTable(["attendance", "attendance_records"]),
    ]);

    const [
      totalRooms,
      hotelBookings,
      accountsTransactions,
      banquetBookings,
      restaurantBills,
      attendanceRecords,
    ] = await Promise.all([
      totalRoomsTable ? safeCount(`SELECT COUNT(*) as c FROM \`${totalRoomsTable}\``) : 0,
      hotelBookingsTable ? safeCount(`SELECT COUNT(*) as c FROM \`${hotelBookingsTable}\``) : 0,
      safeCount("SELECT COUNT(*) as c FROM accounts_transactions"),
      safeCount("SELECT COUNT(*) as c FROM banquet_bookings"),
      restaurantTable ? safeCount(`SELECT COUNT(*) as c FROM \`${restaurantTable}\``) : 0,
      attendanceTable ? safeCount(`SELECT COUNT(*) as c FROM \`${attendanceTable}\``) : 0,
    ]);

    res.json({
      totalRooms,
      hotelBookings,
      accountsTransactions,
      banquetBookings,
      restaurantBills,
      attendanceRecords,
    });
  } catch (err) {
    console.error("Error fetching report summary:", err);
    res.status(500).json({ message: "Error fetching report summary" });
  }
};

exports.getReportData = async (req, res) => {
  const { type, dateFrom, dateTo, status, hall, roomType, paymentMode } = req.query;
  if (!type) return res.status(400).json({ message: "Report type required" });

  try {
    let sql = "";
    let params = [];
    const hasRoomTariffCategory = await columnExists("room_tariff", "category_name").catch(() => false);
    const hasHotelInventory = await tableExists("hotel_room_inventory").catch(() => false);
    const hasRoomCategories = await tableExists("room_categories").catch(() => false);
    const hasLegacyRooms = await tableExists("rooms").catch(() => false);
    const hasLegacyRoomType = hasLegacyRooms
      ? await columnExists("rooms", "room_type").catch(() => false)
      : false;

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
      // Driven by booking_rooms, which is the real per-room row for a stay.
      // room_tariff has no room_number, so a room_tariff join cannot carry the
      // room identifier and every row was filtered out by the WHERE clause.
      const [brCols, rCols, rcCols] = await Promise.all([
        getColumnMap("booking_rooms"),
        hasLegacyRooms ? getColumnMap("rooms") : Promise.resolve({}),
        hasRoomCategories ? getColumnMap("room_categories") : Promise.resolve({}),
      ]);

      // room_categories is the live category table; hotel_room_categories is
      // the older name this branch also looked for.
      const categoryTable = rcCols.name ? "room_categories" : null;
      // Qualified with the join alias, not the table name: the join binds the
      // table as `rc`, so `room_categories.name` is not a valid column reference
      // and MariaDB rejects the SELECT with ER_BAD_FIELD_ERROR.
      const categoryExpr = categoryTable ? "NULLIF(COALESCE(rc.name, ''), '')" : null;

      // room_type comes from whichever legacy column actually exists; rooms has
      // no room_type column, so that branch is a no-op here.
      const legacyTypeExpr = hasLegacyRoomType ? "NULLIF(r.room_type, '')" : null;

      const roomNumberExpr = `COALESCE(NULLIF(r.room_number, ''), hri.room_number, CONCAT('Room #', br.room_id))`;
      const roomTypeExpr = `COALESCE(${[categoryExpr, legacyTypeExpr, roomNumberExpr].filter(Boolean).join(", ")})`;

      sql = `SELECT
        CONCAT(b.id, '-', br.id) as id,
        DATE(b.check_in) as date,
        ${roomNumberExpr} as roomNumber,
        ${roomTypeExpr} as roomType,
        b.status as status,
        COALESCE(NULLIF(br.guest_name, ''), g.first_name) as guest,
        DATE(b.check_out) as checkOut,
        COALESCE(br.total, br.room_charge, br.rate_per_night, 0) as revenue,
        'N/A' as paymentMode
        FROM bookings b
        INNER JOIN booking_rooms br ON br.booking_id = b.id
        ${hasLegacyRooms ? "LEFT JOIN rooms r ON r.id = br.room_id" : ""}
        ${categoryTable && brCols.category_id ? `LEFT JOIN ${categoryTable} rc ON rc.id = br.category_id` : ""}
        ${hasHotelInventory ? "LEFT JOIN hotel_room_inventory hri ON CAST(hri.room_number AS CHAR) = CAST(r.room_number AS CHAR)" : ""}
        LEFT JOIN guest_profiles g ON g.id = b.source_id
        WHERE b.check_in IS NOT NULL`;
      addDateFilter("b.check_in");
      if (status && status !== "All") { sql += " AND b.status = ?"; params.push(status); }
      if (roomType && roomType !== "All") {
        sql += ` AND ${roomTypeExpr} = ?`;
        params.push(roomType);
      }
      sql += " ORDER BY b.id DESC, br.id";

    } else if (type === "banquet") {
      const banquetHallRateColumn = await getBanquetHallRateColumn();
      const banquetRateExpr = banquetHallRateColumn
        ? `COALESCE(h.${banquetHallRateColumn}, 0)`
        : "0";
      sql = `SELECT b.id, DATE(b.date) as date, COALESCE(h.name, CONCAT('Hall #', b.hall_id)) as hall, b.status, b.event_type as eventType, b.guests,
        COALESCE(
          ((${banquetRateExpr}) * GREATEST(1, CEIL(TIMESTAMPDIFF(MINUTE, b.start_time, b.end_time) / 60)))
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
        const restaurantColumns = await getRestaurantBillsColumnMap();
        sql =
          `SELECT id, DATE(created_at) as date, ${
            restaurantColumns?.status || "'Paid'"
          } as status, ${
            restaurantColumns?.tableNumber || "NULL"
          } as \`table_number\`, total as amount, ${
            restaurantColumns?.paymentMethod || "NULL"
          } as paymentMode FROM restaurant_bills WHERE 1=1`;
        addDateFilter("created_at");
        if (paymentMode && paymentMode !== "All" && restaurantColumns?.paymentMethod) {
          sql += ` AND ${restaurantColumns.paymentMethod} = ?`;
          params.push(paymentMode);
        }
        sql += " ORDER BY id DESC";
      } else {
        const billColumns = await getColumnMap("bills");
        const hasCreatedAt = Boolean(billColumns.created_at);
        sql =
          `SELECT id, ${hasCreatedAt ? "DATE(created_at)" : "NULL"} as date, ` +
          `${billColumns.table_number ? "table_number" : "NULL"} as table_number, ` +
          `total as amount, ` +
          `${billColumns.payment_method ? "payment_method" : "NULL"} as paymentMode, ` +
          `${billColumns.payment_status ? "COALESCE(payment_status, 'Paid')" : "'Paid'"} as status ` +
          `FROM bills WHERE 1=1`;
        if (hasCreatedAt) addDateFilter("created_at");
        if (paymentMode && paymentMode !== "All" && billColumns.payment_method) {
          sql += " AND payment_method = ?";
          params.push(paymentMode);
        }
        sql += " ORDER BY id DESC";
      }

    } else if (type === "housekeeping") {
      sql = `SELECT
        id,
        DATE(COALESCE(updated_at, created_at)) as date,
        CAST(roomNo AS CHAR) as roomNo,
        COALESCE(NULLIF(roomType, ''), CAST(roomNo AS CHAR)) as roomType,
        status,
        assignee,
        1 as rooms
        FROM housekeeping WHERE 1=1`;
      if (status && status !== "All") { sql += " AND status = ?"; params.push(status); }
      if (roomType && roomType !== "All") {
        sql += " AND COALESCE(NULLIF(roomType, ''), CAST(roomNo AS CHAR)) = ?";
        params.push(roomType);
      }
      sql += " ORDER BY COALESCE(updated_at, created_at) DESC, CAST(roomNo AS UNSIGNED), roomNo";

    } else if (type === "accounts") {
      sql = "SELECT id, DATE(date) as date, type, description, amount, payment_mode as paymentMode, 'Posted' as status FROM accounts_transactions WHERE 1=1";
      addDateFilter("date");
      if (paymentMode && paymentMode !== "All") { sql += " AND payment_mode = ?"; params.push(paymentMode); }
      sql += " ORDER BY date DESC, id DESC";

    } else if (type === "all-bills") {
      const rows = await getAllBillsRows({ dateFrom, dateTo, status, paymentMode });
      return res.json(rows);
    } else {
      return res.json([]);
    }

    const [rows] = await db.query(sql, params);
    const result = rows.map((row) => ({
      ...row,
      date: toISODate(row.date),
      paymentMode: row.paymentMode ? normalizePaymentMode(row.paymentMode) : row.paymentMode,
    }));
    res.json(result);
  } catch (err) {
    console.error(`Error fetching ${type} report:`, err);
    res.status(500).json({ message: "Failed to fetch report data" });
  }
};
