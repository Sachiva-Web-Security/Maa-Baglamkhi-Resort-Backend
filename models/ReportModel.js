const db = require("../config/db");

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
exports.dailyRoomFood = (reportDate, callback) => {
  const sql = `
    SELECT
      r.number                       AS room,
      COALESCE(b.status, 'Unknown')  AS status,
      COALESCE(b.guest_name, 'Guest') AS guest,
      b.check_in,
      b.check_out,
      COALESCE(b.adult, 0)           AS adult,
      COALESCE(b.child, 0)           AS child,
      COALESCE(b.meal_plan, 'N/A')   AS meal,
      SUM(COALESCE(i.food_charge, 0)) AS food
    FROM rooms r
    LEFT JOIN bookings b
      ON b.room_number = r.number
    LEFT JOIN invoices i
      ON i.room_no = r.number
     AND DATE(COALESCE(i.created_at, i.date)) = DATE(?)
    WHERE DATE(COALESCE(i.created_at, i.date)) = DATE(?)
       OR (DATE(?) BETWEEN DATE(b.check_in) AND DATE(b.check_out))
    GROUP BY r.number, status, guest, b.check_in, b.check_out, adult, child, meal
    ORDER BY r.number;
  `;

  db.query(sql, [reportDate, reportDate, reportDate], callback);
};
