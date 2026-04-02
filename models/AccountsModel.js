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
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows.length > 0;
};

const ensureColumn = async (tableName, columnName, definition) => {
  if (!(await columnExists(tableName, columnName))) {
    await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ROOM_REGEX = /room|hotel|housekeeping|laundry|stay|folio/i;
const RESTAURANT_REGEX = /restaurant|food|kitchen|dining|meal|menu|beverage|snack/i;
const BANQUET_SQL_FILTER = "(LOWER(COALESCE(source_module, '')) LIKE '%banquet%' OR LOWER(COALESCE(description, '')) REGEXP 'banquet|hall|event|catering|decor')";

const inferDepartment = (description = "", explicitDepartment = null) => {
  const normalizedDepartment = String(explicitDepartment || "").trim();
  if (normalizedDepartment) {
    return normalizedDepartment;
  }

  const text = String(description || "");
  if (ROOM_REGEX.test(text)) {
    return "Room";
  }
  if (RESTAURANT_REGEX.test(text)) {
    return "Restaurant";
  }
  return "Other";
};

const backfillDepartmentClassification = async () => {
  await runQuery(`
    UPDATE accounts_transactions
    SET department = 'Room'
    WHERE department = 'Other'
      AND LOWER(COALESCE(description, '')) REGEXP 'room|hotel|housekeeping|laundry|stay|folio'
  `);

  await runQuery(`
    UPDATE accounts_transactions
    SET department = 'Restaurant'
    WHERE department = 'Other'
      AND LOWER(COALESCE(description, '')) REGEXP 'restaurant|food|kitchen|dining|meal|menu|beverage|snack'
  `);
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS accounts_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      type ENUM('Income','Expense') NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_mode VARCHAR(30) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(
    "accounts_transactions",
    "department",
    "ENUM('Room','Restaurant','Other') NOT NULL DEFAULT 'Other' AFTER type",
  );
  await ensureColumn(
    "accounts_transactions",
    "source_module",
    "VARCHAR(50) NULL AFTER department",
  );
  await backfillDepartmentClassification();
};

const getTransactions = async (callback) => {
  try {
    const hasPaymentHistory = await tableExists("payment_history");
    const paymentHistoryUnion = hasPaymentHistory
      ? `
        UNION ALL
        SELECT
          CONCAT('hotel-payment-', ph.id) AS id,
          DATE_FORMAT(DATE(ph.created_at), '%d %b %Y') AS date,
          'Income' AS type,
          'Room' AS department,
          'hotel-payment' AS sourceModule,
          CONCAT(
            'Hotel payment received - Booking #',
            ph.booking_id,
            CASE
              WHEN COALESCE(g.guest_name, '') = '' THEN ''
              ELSE CONCAT(' - ', g.guest_name)
            END
          ) AS description,
          COALESCE(ph.amount, 0) AS amount,
          COALESCE(NULLIF(ph.payment_mode, ''), 'Cash') AS paymentMode,
          DATE(ph.created_at) AS sortDate,
          ph.id AS sortId
        FROM payment_history ph
        LEFT JOIN guests g ON g.id = ph.booking_id
        LEFT JOIN invoices i
          ON (i.booking_id = ph.booking_id OR i.customer_id = ph.booking_id)
         AND LOWER(COALESCE(i.payment_status, i.status, 'pending')) = 'paid'
        WHERE i.id IS NULL
      `
      : "";

    const sql = `
      SELECT id, date, type, department, sourceModule, description, amount, paymentMode
      FROM (
        SELECT
          CAST(at.id AS CHAR) AS id,
          DATE_FORMAT(at.date, '%d %b %Y') AS date,
          at.type AS type,
          at.department AS department,
          at.source_module AS sourceModule,
          at.description AS description,
          at.amount AS amount,
          at.payment_mode AS paymentMode,
          at.date AS sortDate,
          at.id AS sortId
        FROM accounts_transactions at
        ${paymentHistoryUnion}
      ) entries
      ORDER BY sortDate DESC, sortId DESC
    `;

    const rows = await runQuery(sql);
    callback(null, rows);
  } catch (error) {
    callback(error);
  }
};

const createTransaction = (data, callback) => {
  const sql =
    "INSERT INTO accounts_transactions (date, type, department, source_module, description, amount, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?)";
  const department = inferDepartment(data.description, data.department);
  db.query(
    sql,
    [
      data.date,
      data.type,
      department,
      data.sourceModule || null,
      data.description,
      data.amount,
      data.paymentMode,
    ],
    callback,
  );
};

const getSummary = (callback) => {
  const sql = `
    SELECT
      COALESCE((
        SELECT SUM(COALESCE(total_amount, final_total, subtotal + gst - discount, 0))
        FROM invoices
        WHERE LOWER(COALESCE(payment_status, status, 'pending')) = 'paid'
      ), 0) AS invoiceIncome,

      COALESCE((
        SELECT SUM(COALESCE(gst, 0))
        FROM invoices
        WHERE LOWER(COALESCE(payment_status, status, 'pending')) = 'paid'
      ), 0) AS invoiceGst,

      COALESCE((
        SELECT SUM(COALESCE(total, 0))
        FROM restaurant_bills
        WHERE LOWER(COALESCE(invoiceStatus, 'pending')) = 'paid'
      ), 0) AS restaurantIncome,

      COALESCE((
        SELECT SUM(GREATEST(COALESCE(ap.amount, 0) - COALESCE(ap.refund_amount, 0), 0))
        FROM advance_payment ap
        LEFT JOIN invoices i
          ON (i.booking_id = ap.booking_id OR i.customer_id = ap.booking_id)
         AND LOWER(COALESCE(i.payment_status, i.status, 'pending')) = 'paid'
        WHERE i.id IS NULL
      ), 0) AS hotelAdvanceIncome,

      COALESCE((
        SELECT SUM(
          CASE
            WHEN COALESCE(rt.billTotal, 0) <= 0 OR COALESCE(rt.billGst, 0) <= 0 THEN 0
            ELSE ROUND(
              LEAST(
                GREATEST(COALESCE(ap.amount, 0) - COALESCE(ap.refund_amount, 0), 0),
                GREATEST(COALESCE(rt.billTotal, 0) - COALESCE(ap.discount_amount, 0), 0)
              ) * (COALESCE(rt.billGst, 0) / NULLIF(COALESCE(rt.billTotal, 0), 0)),
              2
            )
          END
        )
        FROM advance_payment ap
        INNER JOIN (
          SELECT booking_id, SUM(COALESCE(total, 0)) AS billTotal, SUM(COALESCE(gst, 0)) AS billGst
          FROM room_tariff
          GROUP BY booking_id
        ) rt ON rt.booking_id = ap.booking_id
        LEFT JOIN invoices i
          ON (i.booking_id = ap.booking_id OR i.customer_id = ap.booking_id)
         AND LOWER(COALESCE(i.payment_status, i.status, 'pending')) = 'paid'
        WHERE i.id IS NULL
      ), 0) AS hotelAdvanceGst,

      COALESCE((
        SELECT SUM(COALESCE(gst, 0))
        FROM restaurant_bills
        WHERE LOWER(COALESCE(invoiceStatus, 'pending')) = 'paid'
      ), 0) AS restaurantGst,

      COALESCE((
        SELECT SUM(COALESCE(grand_total, 0))
        FROM banquet_bookings
        WHERE COALESCE(invoice_no, '') <> ''
          AND LOWER(COALESCE(payment_status, 'pending')) = 'paid'
      ), 0) AS banquetIncome,

      COALESCE((
        SELECT SUM(
          ROUND(
            (COALESCE(grand_total, 0) * COALESCE(gst_percent, 0))
            / NULLIF(100 + COALESCE(gst_percent, 0), 0),
            2
          )
        )
        FROM banquet_bookings
        WHERE COALESCE(invoice_no, '') <> ''
          AND LOWER(COALESCE(payment_status, 'pending')) = 'paid'
      ), 0) AS banquetGst,

      COALESCE((
        SELECT SUM(COALESCE(amount, 0))
        FROM accounts_transactions
        WHERE type = 'Income'
      ), 0) AS manualIncome,

      COALESCE((
        SELECT SUM(COALESCE(amount, 0))
        FROM accounts_transactions
        WHERE type = 'Expense'
      ), 0) AS totalExpense
  `;
  db.query(sql, callback);
};

const getDepartmentSummary = (callback) => {
  const sql = `
    SELECT
      COALESCE((
        SELECT SUM(
          CASE
            WHEN COALESCE(food_charge, 0) <= 0
              THEN COALESCE(total_amount, final_total, subtotal + gst - discount, COALESCE(price_per_day, 0) + COALESCE(extra_charge, 0))
            WHEN COALESCE(price_per_day, 0) + COALESCE(extra_charge, 0) <= 0
              THEN 0
            ELSE ROUND(
              COALESCE(total_amount, final_total, subtotal + gst - discount, 0)
              * ((COALESCE(price_per_day, 0) + COALESCE(extra_charge, 0))
              / NULLIF(COALESCE(price_per_day, 0) + COALESCE(extra_charge, 0) + COALESCE(food_charge, 0), 0)),
              2
            )
          END
        )
        FROM invoices
        WHERE LOWER(COALESCE(payment_status, status, 'pending')) = 'paid'
      ), 0)
      +
      COALESCE((
        SELECT SUM(COALESCE(amount, 0))
        FROM accounts_transactions
        WHERE type = 'Income' AND department = 'Room'
      ), 0)
      +
      COALESCE((
        SELECT SUM(GREATEST(COALESCE(ap.amount, 0) - COALESCE(ap.refund_amount, 0), 0))
        FROM advance_payment ap
        LEFT JOIN invoices i
          ON (i.booking_id = ap.booking_id OR i.customer_id = ap.booking_id)
         AND LOWER(COALESCE(i.payment_status, i.status, 'pending')) = 'paid'
        WHERE i.id IS NULL
      ), 0) AS roomIncome,

      (
        COALESCE((
          SELECT SUM(
            CASE
              WHEN COALESCE(food_charge, 0) <= 0
                THEN 0
              ELSE ROUND(
                COALESCE(total_amount, final_total, subtotal + gst - discount, 0)
                * (COALESCE(food_charge, 0)
                / NULLIF(COALESCE(price_per_day, 0) + COALESCE(extra_charge, 0) + COALESCE(food_charge, 0), 0)),
                2
              )
            END
          )
          FROM invoices
          WHERE LOWER(COALESCE(payment_status, status, 'pending')) = 'paid'
        ), 0)
        +
        COALESCE((
          SELECT SUM(COALESCE(total, 0))
          FROM restaurant_bills
          WHERE LOWER(COALESCE(invoiceStatus, 'pending')) = 'paid'
        ), 0)
        +
        COALESCE((
          SELECT SUM(COALESCE(amount, 0))
          FROM accounts_transactions
          WHERE type = 'Income' AND department = 'Restaurant'
        ), 0)
      ) AS restaurantIncome,

      COALESCE((
        SELECT SUM(COALESCE(amount, 0))
        FROM accounts_transactions
        WHERE type = 'Expense' AND department = 'Room'
      ), 0) AS roomExpense,

      COALESCE((
        SELECT SUM(COALESCE(amount, 0))
        FROM accounts_transactions
        WHERE type = 'Expense' AND department = 'Restaurant'
      ), 0) AS restaurantExpense,

      COALESCE((
        SELECT SUM(COALESCE(grand_total, 0))
        FROM banquet_bookings
        WHERE COALESCE(invoice_no, '') <> ''
          AND LOWER(COALESCE(payment_status, 'pending')) = 'paid'
      ), 0)
      +
      COALESCE((
        SELECT SUM(COALESCE(amount, 0))
        FROM accounts_transactions
        WHERE type = 'Income'
          AND ${BANQUET_SQL_FILTER}
      ), 0) AS banquetIncome,

      COALESCE((
        SELECT SUM(COALESCE(amount, 0))
        FROM accounts_transactions
        WHERE type = 'Expense'
          AND ${BANQUET_SQL_FILTER}
      ), 0) AS banquetExpense
  `;
  db.query(sql, callback);
};

const getHotelBillingRecords = async (callback) => {
  try {
    const rows = await runQuery(`
      SELECT
        g.id,
        g.id AS bookingId,
        g.booking_code AS bookingCode,
        g.guest_name AS customerName,
        DATE_FORMAT(COALESCE(g.check_out, g.check_in), '%Y-%m-%d') AS date,
        GROUP_CONCAT(DISTINCT CAST(rt.room_number AS CHAR) ORDER BY rt.room_number SEPARATOR ', ') AS roomNo,
        COALESCE(SUM(rt.total), 0) AS totalAmount,
        COALESCE(SUM(rt.gst), 0) AS gstAmount,
        IFNULL(a.amount, 0) AS paidAmount,
        IFNULL(a.discount_amount, 0) AS discountAmount,
        IFNULL(a.refund_amount, 0) AS refundAmount,
        (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) AS netPaid,
        (
          COALESCE(SUM(rt.total), 0) -
          ((IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) + IFNULL(a.discount_amount, 0))
        ) AS remainingAmount,
        COALESCE(NULLIF(a.payment_mode, ''), 'Pending') AS paymentMode,
        CASE
          WHEN (COALESCE(SUM(rt.total), 0) -
            ((IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) + IFNULL(a.discount_amount, 0))) <= 0
            AND (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) > 0
            THEN 'Paid'
          WHEN (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) > 0
            THEN 'Partial'
          ELSE 'Pending'
        END AS paymentStatus,
        g.booking_status AS bookingStatus
      FROM guests g
      INNER JOIN room_tariff rt ON rt.booking_id = g.id
      LEFT JOIN advance_payment a ON a.booking_id = g.id
      GROUP BY
        g.id,
        g.booking_code,
        g.guest_name,
        g.check_in,
        g.check_out,
        g.booking_status,
        a.amount,
        a.discount_amount,
        a.refund_amount,
        a.payment_mode
      HAVING
        (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) > 0
        OR IFNULL(a.discount_amount, 0) > 0
      ORDER BY g.id DESC
    `);

    callback(null, rows);
  } catch (error) {
    callback(error);
  }
};

const getRestaurantBillingRecords = async (callback) => {
  try {
    const rows = await runQuery(`
      SELECT *
      FROM (
        SELECT
          CONCAT('restaurant-bill-', rb.id) AS id,
          'restaurant_bill' AS sourceType,
          CONCAT('RBILL-', rb.id) AS reference,
          COALESCE(NULLIF(rb.customerName, ''), 'Walk-in') AS customerName,
          COALESCE(NULLIF(rb.tableNumber, ''), '') AS locationLabel,
          DATE_FORMAT(COALESCE(rb.paid_at, rb.created_at), '%Y-%m-%d') AS date,
          COALESCE(rb.total, 0) AS total,
          COALESCE(NULLIF(rb.paymentMethod, ''), 'Pending') AS paymentMode,
          COALESCE(NULLIF(rb.invoiceStatus, ''), 'Pending') AS paymentStatus,
          rb.id AS actionId
        FROM restaurant_bills rb

        UNION ALL

        SELECT
          CONCAT('room-order-', ro.id) AS id,
          'room_order' AS sourceType,
          CONCAT('ROOM-ORDER-', ro.id) AS reference,
          'Room Service Guest' AS customerName,
          CONCAT('Room ', COALESCE(NULLIF(ro.roomNumber, ''), '-')) AS locationLabel,
          DATE_FORMAT(ro.created_at, '%Y-%m-%d') AS date,
          COALESCE(SUM(roi.price * roi.quantity), 0) AS total,
          CASE
            WHEN LOWER(COALESCE(ro.status, 'pending')) = 'paid' THEN 'Paid'
            ELSE 'Pending'
          END AS paymentMode,
          CASE
            WHEN LOWER(COALESCE(ro.status, 'pending')) IN ('paid', 'served', 'completed') THEN 'Paid'
            WHEN LOWER(COALESCE(ro.status, 'pending')) IN ('cancelled', 'canceled') THEN 'Cancelled'
            ELSE 'Pending'
          END AS paymentStatus,
          ro.id AS actionId
        FROM room_orders ro
        LEFT JOIN room_order_items roi ON roi.order_id = ro.id
        WHERE LOWER(COALESCE(ro.status, 'pending')) IN ('served', 'paid', 'completed')
        GROUP BY ro.id, ro.roomNumber, ro.status, ro.created_at
      ) records
      WHERE COALESCE(total, 0) > 0
      ORDER BY date DESC, actionId DESC
    `);

    callback(null, rows);
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  ensureSchema,
  getTransactions,
  createTransaction,
  getSummary,
  getDepartmentSummary,
  getHotelBillingRecords,
  getRestaurantBillingRecords,
};
