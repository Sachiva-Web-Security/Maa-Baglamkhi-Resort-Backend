const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const tableExists = async (tableName) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  try {
    const rows = await runQuery(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    return false;
  }
};

const getScalar = async (sql, params = []) => {
  const rows = await runQuery(sql, params);
  if (!Array.isArray(rows) || !rows.length) {
    return null;
  }
  const firstRow = rows[0] || {};
  const firstKey = Object.keys(firstRow)[0];
  return firstKey ? firstRow[firstKey] : null;
};

const getLatestAvailableRoomFoodDate = async () => {
  const candidateDates = [];

  if (await tableExists("invoices")) {
    const hasCreatedAt = await columnExists("invoices", "created_at");
    const hasDate = await columnExists("invoices", "date");
    if (hasCreatedAt || hasDate) {
      const dateExpr = hasCreatedAt && hasDate ? "COALESCE(created_at, date)" : hasCreatedAt ? "created_at" : "date";
      const latestInvoiceDate = await getScalar(`SELECT DATE(MAX(${dateExpr})) AS latest_date FROM invoices`);
      if (latestInvoiceDate) {
        candidateDates.push(String(latestInvoiceDate).slice(0, 10));
      }
    }
  }

  if (await tableExists("bills")) {
    const hasCreatedAt = await columnExists("bills", "created_at");
    const latestBillDate = hasCreatedAt
      ? await getScalar("SELECT DATE(MAX(created_at)) AS latest_date FROM bills")
      : null;
    if (latestBillDate) {
      candidateDates.push(String(latestBillDate).slice(0, 10));
    }
  }

  if (await tableExists("guests")) {
    const latestGuestDate = await getScalar(
      "SELECT DATE(MAX(COALESCE(check_out, check_in))) AS latest_date FROM guests",
    );
    if (latestGuestDate) {
      candidateDates.push(String(latestGuestDate).slice(0, 10));
    }
  }

  return candidateDates.sort().reverse()[0] || new Date().toISOString().slice(0, 10);
};

// DAYWISE REPORT
exports.daywiseReport = (start, end, callback) => {
  const sql = `
  SELECT DATE(created_at) as date,
  SUM(total) as total
  FROM payments
  WHERE DATE(created_at) BETWEEN ? AND ?
  GROUP BY DATE(created_at)
  `;

  db.query(sql, [start, end], callback);
};

// ITEM CONSUMPTION
exports.itemConsumption = (callback) => {
  const sql = `
  SELECT item_name,
  SUM(qty) as quantity
  FROM token_items
  GROUP BY item_name
  `;

  db.query(sql, callback);
};

// DAYWISE FOOD FROM INVOICES
exports.daywiseFood = (start, end, callback) => {
  const sql = `
    SELECT
      DATE(COALESCE(created_at, date)) AS bill_date,
      SUM(final_total / 1.05)           AS restaurant_sales,
      SUM(final_total - (final_total / 1.05)) AS gst_amount,
      SUM(final_total)                  AS total_sales
    FROM invoices
    WHERE COALESCE(created_at, date) BETWEEN ? AND ?
    GROUP BY bill_date
    ORDER BY bill_date DESC
  `;

  db.query(sql, [start, end], callback);
};

// DAILY ROOMWISE FOOD (by invoice date)
exports.dailyRoomFood = async (reportDate, callback) => {
  try {
    const resolvedDate = reportDate || (await getLatestAvailableRoomFoodDate());
    const hasRooms = await tableExists("rooms");
    const hasInvoices = await tableExists("invoices");
    const hasGuests = await tableExists("guests");
    const hasRoomTariff = await tableExists("room_tariff");
    const hasPax = await tableExists("pax");
    const hasBills = await tableExists("bills");
    const hasRoomInventory = await tableExists("hotel_room_inventory");
    let inventoryRows = [];
    if (hasRoomInventory) {
      inventoryRows = await runQuery(`
        SELECT
          CAST(room_number AS CHAR) AS room,
          room_number
        FROM hotel_room_inventory
        ORDER BY CAST(room_number AS UNSIGNED), room_number
      `);
    }

    let roomRows = [];
    if (hasRooms) {
      const roomNumberColumn = (await columnExists("rooms", "room_number")) ? "room_number" : "number";
      const hasRoomStatus = await columnExists("rooms", "status");
      const hasRoomGuest = await columnExists("rooms", "guest");
      const hasRoomCheckIn = await columnExists("rooms", "check_in");
      const hasRoomCheckOut = await columnExists("rooms", "check_out");

      const roomSql = `
        SELECT
          CAST(${roomNumberColumn} AS CHAR) AS room,
          ${hasRoomStatus ? "status" : "'Unknown'"} AS status,
          ${hasRoomGuest ? "guest" : "NULL"} AS guest,
          ${hasRoomCheckIn ? "DATE(check_in)" : "NULL"} AS checkin,
          ${hasRoomCheckOut ? "DATE(check_out)" : "NULL"} AS checkout
        FROM rooms
        ORDER BY CAST(${roomNumberColumn} AS UNSIGNED), ${roomNumberColumn}
      `;
      roomRows = await runQuery(roomSql);
    }

    let guestRows = [];
    if (hasGuests && hasRoomTariff) {
      guestRows = await runQuery(
        `
          SELECT
            g.id,
            g.guest_name,
            g.check_in,
            g.check_out,
            g.booking_status,
            CAST(rt.room_number AS CHAR) AS room_number
          FROM guests
          g
          LEFT JOIN room_tariff rt ON g.id = rt.booking_id
          WHERE rt.room_number IS NOT NULL
            AND g.check_in IS NOT NULL
            AND DATE(?) BETWEEN DATE(g.check_in) AND DATE(g.check_out)
        `,
        [resolvedDate],
      );
    }

    let paxRows = [];
    const paxHasBookingId = hasPax && (await columnExists("pax", "booking_id"));
    const paxHasRoomNumber = hasPax && (await columnExists("pax", "room_number"));
    const paxHasAdults = hasPax && (await columnExists("pax", "adults"));
    const paxHasChildren = hasPax && (await columnExists("pax", "children"));
    const paxHasMealPlan = hasPax && (await columnExists("pax", "meal_plan"));
    if (hasGuests && hasPax && guestRows.length && paxHasBookingId) {
      paxRows = await runQuery(
        `
          SELECT
            booking_id,
            ${paxHasRoomNumber ? "CAST(room_number AS CHAR)" : "NULL"} AS room_number,
            ${paxHasAdults ? "adults" : "0"} AS adults,
            ${paxHasChildren ? "children" : "0"} AS children,
            ${paxHasMealPlan ? "meal_plan" : "NULL"} AS meal_plan
          FROM pax
        `,
      );
    }

    let invoiceRows = [];
    if (hasInvoices) {
      const hasInvoiceRoomNo = await columnExists("invoices", "room_no");
      const hasInvoiceFoodCharge = await columnExists("invoices", "food_charge");
      const hasInvoiceFinalTotal = await columnExists("invoices", "final_total");
      const hasInvoiceCreatedAt = await columnExists("invoices", "created_at");
      const hasInvoiceDate = await columnExists("invoices", "date");

      if (!hasInvoiceRoomNo || (!hasInvoiceFoodCharge && !hasInvoiceFinalTotal) || (!hasInvoiceCreatedAt && !hasInvoiceDate)) {
        invoiceRows = [];
      } else {
      const invoiceDateExpr =
        hasInvoiceCreatedAt && hasInvoiceDate
          ? "COALESCE(created_at, date)"
          : hasInvoiceCreatedAt
            ? "created_at"
            : "date";

        invoiceRows = await runQuery(
          `
            SELECT
              CAST(room_no AS CHAR) AS room,
              COALESCE(${hasInvoiceFoodCharge ? "food_charge" : "final_total"}, 0) AS food
            FROM invoices
            WHERE DATE(${invoiceDateExpr}) = DATE(?)
          `,
          [resolvedDate],
        );
      }
    }

    let billRows = [];
    if (hasBills) {
      const hasBillCreatedAt = await columnExists("bills", "created_at");
      const hasBillTableNumber = await columnExists("bills", "tableNumber");
      const hasBillTotal = await columnExists("bills", "total");
      if (hasBillCreatedAt && hasBillTableNumber && hasBillTotal) {
        billRows = await runQuery(
          `
            SELECT
              CAST(tableNumber AS CHAR) AS room,
              COALESCE(total, 0) AS food
            FROM bills
            WHERE DATE(created_at) = DATE(?)
          `,
          [resolvedDate],
        );
      }
    }

    const invoiceMap = invoiceRows.reduce((acc, row) => {
      acc[row.room] = (acc[row.room] || 0) + Number(row.food || 0);
      return acc;
    }, {});

    const billMap = billRows.reduce((acc, row) => {
      acc[row.room] = (acc[row.room] || 0) + Number(row.food || 0);
      return acc;
    }, {});

    const guestForRoom = {};
    guestRows.forEach((guest) => {
      const paxForGuest = paxRows.filter((pax) => Number(pax.booking_id) === Number(guest.id));
      const paxTotals = paxForGuest.reduce(
        (acc, pax) => {
          acc.adult += Number(pax.adults || 0);
          acc.child += Number(pax.children || 0);
          if (!acc.meal && pax.meal_plan) {
            acc.meal = pax.meal_plan;
          }
          return acc;
        },
        { adult: 0, child: 0, meal: null },
      );
      if (!guest.room_number) {
        return;
      }
      guestForRoom[String(guest.room_number)] = {
        guest: guest.guest_name,
        status: guest.booking_status,
        checkin: guest.check_in,
        checkout: guest.check_out,
        adult: paxTotals.adult,
        child: paxTotals.child,
        meal: paxTotals.meal || "N/A",
      };
    });

    const knownRoomNumbers = new Set([
      ...inventoryRows.map((room) => String(room.room)),
      ...roomRows.map((room) => String(room.room)),
      ...guestRows.map((guest) => String(guest.room_number)),
    ]);

    const billRooms = Object.keys(billMap).filter((room) => knownRoomNumbers.has(String(room)) || /^\d+$/.test(String(room)));
    const invoiceRooms = Object.keys(invoiceMap);
    const allRooms = Array.from(
      new Set([
        ...knownRoomNumbers,
        ...invoiceRooms,
        ...billRooms,
      ]),
    ).filter(Boolean);

    const roomStatusMap = roomRows.reduce((acc, room) => {
      acc[String(room.room)] = room;
      return acc;
    }, {});

    const rows = allRooms
      .map((roomNo) => {
        const room = roomStatusMap[String(roomNo)] || {};
        const guest = guestForRoom[String(roomNo)] || null;
        const foodAmount = Number(invoiceMap[String(roomNo)] || 0) + Number(billMap[String(roomNo)] || 0);
        return {
          room: String(roomNo),
          status: room.status || guest?.status || (guest ? "Occupied" : "Unknown"),
          guest: room.guest || guest?.guest || (foodAmount > 0 ? "Walk-in / Room Billing" : "Guest"),
          checkin: room.checkin || guest?.checkin || null,
          checkout: room.checkout || guest?.checkout || null,
          adult: Number(guest?.adult || 0),
          child: Number(guest?.child || 0),
          meal: guest?.meal || "N/A",
          food: foodAmount,
          reportDate: resolvedDate,
        };
      })
      .filter((row) => {
        const dateMatch = row.food > 0;
        const stayMatch =
          row.checkin &&
          row.checkout &&
          resolvedDate >= String(row.checkin).slice(0, 10) &&
          resolvedDate <= String(row.checkout).slice(0, 10);
        return dateMatch || stayMatch;
      })
      .sort((a, b) => Number(a.room) - Number(b.room));

    callback(null, rows);
  } catch (error) {
    callback(error);
  }
};
