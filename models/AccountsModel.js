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

const getInvoiceSchemaConfig = async () => {
  const [
    hasBookingId,
    hasCustomerId,
    hasCustomerName,
    hasGuestName,
    hasTotalAmount,
    hasFinalTotal,
    hasSubtotal,
    hasDiscount,
    hasGst,
    hasRoomNo,
    hasDate,
    hasCreatedAt,
    hasPaymentMode,
    hasPaymentStatus,
    hasStatus,
    hasPricePerDay,
    hasExtraCharge,
    hasFoodCharge,
  ] = await Promise.all([
    columnExists("invoices", "booking_id"),
    columnExists("invoices", "customer_id"),
    columnExists("invoices", "customer_name"),
    columnExists("invoices", "guest_name"),
    columnExists("invoices", "total_amount"),
    columnExists("invoices", "final_total"),
    columnExists("invoices", "subtotal"),
    columnExists("invoices", "discount"),
    columnExists("invoices", "gst"),
    columnExists("invoices", "room_no"),
    columnExists("invoices", "date"),
    columnExists("invoices", "created_at"),
    columnExists("invoices", "payment_mode"),
    columnExists("invoices", "payment_status"),
    columnExists("invoices", "status"),
    columnExists("invoices", "price_per_day"),
    columnExists("invoices", "extra_charge"),
    columnExists("invoices", "food_charge"),
  ]);

  const paidStatusExpr = hasPaymentStatus && hasStatus
    ? "LOWER(COALESCE(payment_status, status, 'pending'))"
    : hasPaymentStatus
      ? "LOWER(COALESCE(payment_status, 'pending'))"
      : hasStatus
        ? "LOWER(COALESCE(status, 'pending'))"
        : "'pending'";

  const paidStatusExprForJoin = hasPaymentStatus && hasStatus
    ? "LOWER(COALESCE(i.payment_status, i.status, 'pending'))"
    : hasPaymentStatus
      ? "LOWER(COALESCE(i.payment_status, 'pending'))"
      : hasStatus
        ? "LOWER(COALESCE(i.status, 'pending'))"
        : "'pending'";

  const invoiceAmountExprParts = [];
  if (hasTotalAmount) invoiceAmountExprParts.push("NULLIF(total_amount, 0)");
  if (hasFinalTotal) invoiceAmountExprParts.push("NULLIF(final_total, 0)");
  if (hasSubtotal && hasGst && hasDiscount) {
    invoiceAmountExprParts.push("NULLIF(subtotal + gst - discount, 0)");
  } else if (hasSubtotal) {
    invoiceAmountExprParts.push("NULLIF(subtotal, 0)");
  }

  const invoiceAmountExpr = invoiceAmountExprParts.length
    ? `COALESCE(${invoiceAmountExprParts.join(", ")}, 0)`
    : "0";

  const customerNameExpr = hasCustomerName && hasGuestName
    ? "COALESCE(NULLIF(customer_name, ''), NULLIF(guest_name, ''), 'Walk-in Guest')"
    : hasCustomerName
      ? "COALESCE(NULLIF(customer_name, ''), 'Walk-in Guest')"
      : hasGuestName
        ? "COALESCE(NULLIF(guest_name, ''), 'Walk-in Guest')"
        : "'Walk-in Guest'";

  const bookingJoinConditions = [];
  if (hasBookingId) bookingJoinConditions.push("i.booking_id = ?");
  if (hasCustomerId) bookingJoinConditions.push("i.customer_id = ?");

  return {
    hasBookingId,
    hasCustomerId,
    hasGst,
    hasRoomNo,
    hasDate,
    hasCreatedAt,
    hasPaymentMode,
    hasPricePerDay,
    hasExtraCharge,
    hasFoodCharge,
    paidStatusExpr,
    paidStatusExprForJoin,
    invoiceAmountExpr,
    customerNameExpr,
    bookingJoinConditionSql: bookingJoinConditions.length
      ? `(${bookingJoinConditions.join(" OR ")})`
      : null,
  };
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
    const hasInvoices = await tableExists("invoices");
    const invoiceConfig = hasInvoices ? await getInvoiceSchemaConfig() : null;
    const invoiceJoinSql =
      hasInvoices && invoiceConfig?.bookingJoinConditionSql
        ? `
        LEFT JOIN invoices i
          ON ${invoiceConfig.bookingJoinConditionSql.replace(/\?/g, "ph.booking_id")}
         AND ${invoiceConfig.paidStatusExprForJoin} = 'paid'
      `
        : "";
    const invoiceJoinFilter =
      hasInvoices && invoiceConfig?.bookingJoinConditionSql ? "WHERE i.id IS NULL" : "";
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
        ${invoiceJoinSql}
        ${invoiceJoinFilter}
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
  (async () => {
    const hasInvoices = await tableExists("invoices");
    const invoiceConfig = hasInvoices ? await getInvoiceSchemaConfig() : null;
    const invoicePaidFilter = invoiceConfig ? `${invoiceConfig.paidStatusExpr} = 'paid'` : "1 = 0";
    const invoiceAmountExpr = invoiceConfig?.invoiceAmountExpr || "0";
    const invoiceGstExpr = invoiceConfig?.hasGst ? "COALESCE(gst, 0)" : "0";
    const advanceInvoiceJoin =
      invoiceConfig?.bookingJoinConditionSql
        ? `
        LEFT JOIN invoices i
          ON ${invoiceConfig.bookingJoinConditionSql.replace(/\?/g, "ap.booking_id")}
         AND ${invoicePaidFilter}
      `
        : "LEFT JOIN invoices i ON 1 = 0";

    const sql = `
    SELECT
      COALESCE((
        SELECT SUM(${invoiceAmountExpr})
        FROM invoices
        WHERE ${invoicePaidFilter}
      ), 0) AS invoiceIncome,

      COALESCE((
        SELECT SUM(${invoiceGstExpr})
        FROM invoices
        WHERE ${invoicePaidFilter}
      ), 0) AS invoiceGst,

      COALESCE((
        SELECT SUM(COALESCE(total, 0))
        FROM restaurant_bills
        WHERE LOWER(COALESCE(invoiceStatus, 'pending')) = 'paid'
      ), 0) AS restaurantIncome,

      COALESCE((
        SELECT SUM(GREATEST(COALESCE(ap.amount, 0) - COALESCE(ap.refund_amount, 0), 0))
        FROM advance_payment ap
        ${advanceInvoiceJoin}
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
        ${advanceInvoiceJoin}
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
  })().catch((error) => callback(error));
};

const getDepartmentSummary = (callback) => {
  (async () => {
    const hasInvoices = await tableExists("invoices");
    const invoiceConfig = hasInvoices ? await getInvoiceSchemaConfig() : null;
    const invoicePaidFilter = invoiceConfig ? `${invoiceConfig.paidStatusExpr} = 'paid'` : "1 = 0";
    const invoiceAmountExpr = invoiceConfig?.invoiceAmountExpr || "0";
    const invoiceRoomBaseExpr =
      invoiceConfig && (invoiceConfig.hasPricePerDay || invoiceConfig.hasExtraCharge)
        ? `${invoiceConfig.hasPricePerDay ? "COALESCE(price_per_day, 0)" : "0"} + ${invoiceConfig.hasExtraCharge ? "COALESCE(extra_charge, 0)" : "0"}`
        : "0";
    const invoiceFoodChargeExpr =
      invoiceConfig?.hasFoodCharge ? "COALESCE(food_charge, 0)" : "0";
    const advanceInvoiceJoin =
      invoiceConfig?.bookingJoinConditionSql
        ? `
        LEFT JOIN invoices i
          ON ${invoiceConfig.bookingJoinConditionSql.replace(/\?/g, "ap.booking_id")}
         AND ${invoicePaidFilter}
      `
        : "LEFT JOIN invoices i ON 1 = 0";

    const sql = `
    SELECT
      COALESCE((
        SELECT SUM(
          CASE
            WHEN ${invoiceFoodChargeExpr} <= 0
              THEN COALESCE(${invoiceAmountExpr}, ${invoiceRoomBaseExpr})
            WHEN ${invoiceRoomBaseExpr} <= 0
              THEN 0
            ELSE ROUND(
              ${invoiceAmountExpr}
              * ((${invoiceRoomBaseExpr})
              / NULLIF(${invoiceRoomBaseExpr} + ${invoiceFoodChargeExpr}, 0)),
              2
            )
          END
        )
        FROM invoices
        WHERE ${invoicePaidFilter}
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
        ${advanceInvoiceJoin}
        WHERE i.id IS NULL
      ), 0) AS roomIncome,

      (
        COALESCE((
          SELECT SUM(
            CASE
              WHEN ${invoiceFoodChargeExpr} <= 0
                THEN 0
              ELSE ROUND(
                ${invoiceAmountExpr}
                * (${invoiceFoodChargeExpr}
                / NULLIF(${invoiceRoomBaseExpr} + ${invoiceFoodChargeExpr}, 0)),
                2
              )
            END
          )
          FROM invoices
          WHERE ${invoicePaidFilter}
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
  })().catch((error) => callback(error));
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
