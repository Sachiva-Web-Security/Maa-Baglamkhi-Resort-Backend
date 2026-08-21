const db = require("../config/db");

const GST_RATE = 0.05;

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const roundMoney = (value) => Number((Number(value || 0)).toFixed(2));

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

const formatDateKey = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const buildInvoiceNo = (bookingId) =>
  `HOTINV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(bookingId).padStart(4, "0")}`;

const normalizeInvoiceKey = (row = {}) => {
  const bookingId = Number(row.booking_id || row.customer_id || 0);
  if (bookingId > 0) {
    return `booking:${bookingId}`;
  }

  const invoiceNo = String(row.invoice_no || "").trim();
  if (invoiceNo) {
    return `invoice:${invoiceNo}`;
  }

  return `row:${row.id || "unknown"}`;
};

const dedupeInvoiceRows = (rows = []) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalizeInvoiceKey(row);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getLatestInvoiceRow = async (bookingId) => {
  const rows = await runQuery(
    `
      SELECT id, invoice_no, payment_status, payment_mode, status, notes
      FROM invoices
      WHERE booking_id = ? OR customer_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    [bookingId, bookingId],
  );

  return rows[0] || null;
};

const removeDuplicateInvoices = async ({ keepId, bookingId, invoiceNo }) => {
  const filters = [];
  const params = [];

  if (Number(bookingId) > 0) {
    filters.push("booking_id = ?");
    params.push(Number(bookingId));
    filters.push("customer_id = ?");
    params.push(Number(bookingId));
  }

  if (String(invoiceNo || "").trim()) {
    filters.push("invoice_no = ?");
    params.push(String(invoiceNo).trim());
  }

  if (!filters.length) {
    return;
  }

  const duplicateRows = await runQuery(
    `
      SELECT id
      FROM invoices
      WHERE id <> ?
        AND (${filters.join(" OR ")})
    `,
    [keepId, ...params],
  );

  if (!duplicateRows.length) {
    return;
  }

  const deleteIds = duplicateRows.map((row) => Number(row.id)).filter(Boolean);
  const placeholders = deleteIds.map(() => "?").join(", ");
  await runQuery(`DELETE FROM invoices WHERE id IN (${placeholders})`, deleteIds);
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT NOT NULL AUTO_INCREMENT,
      invoice_no VARCHAR(120) NOT NULL,
      date DATE NULL,
      customer_name VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(30) DEFAULT NULL,
      room_no VARCHAR(255) DEFAULT NULL,
      check_in DATE DEFAULT NULL,
      check_out DATE DEFAULT NULL,
      price_per_day DECIMAL(12,2) DEFAULT 0,
      food_charge DECIMAL(12,2) DEFAULT 0,
      extra_charge DECIMAL(12,2) DEFAULT 0,
      gst DECIMAL(12,2) DEFAULT 0,
      discount DECIMAL(12,2) DEFAULT 0,
      final_total DECIMAL(12,2) DEFAULT 0,
      payment_mode VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      notes TEXT NULL,
      booking_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_invoice_no (invoice_no)
    )
  `);

  await ensureColumn("invoices", "date", "DATE NULL AFTER invoice_no");
  await ensureColumn("invoices", "customer_name", "VARCHAR(255) DEFAULT NULL AFTER date");
  await ensureColumn("invoices", "phone", "VARCHAR(30) DEFAULT NULL AFTER customer_name");
  await ensureColumn("invoices", "room_no", "VARCHAR(255) DEFAULT NULL AFTER phone");
  await ensureColumn("invoices", "check_in", "DATE DEFAULT NULL AFTER room_no");
  await ensureColumn("invoices", "check_out", "DATE DEFAULT NULL AFTER check_in");
  await ensureColumn("invoices", "price_per_day", "DECIMAL(12,2) DEFAULT 0 AFTER check_out");
  await ensureColumn("invoices", "food_charge", "DECIMAL(12,2) DEFAULT 0 AFTER price_per_day");
  await ensureColumn("invoices", "extra_charge", "DECIMAL(12,2) DEFAULT 0 AFTER food_charge");
  await ensureColumn("invoices", "subtotal", "DECIMAL(12,2) DEFAULT 0 AFTER extra_charge");
  await ensureColumn("invoices", "final_total", "DECIMAL(12,2) DEFAULT 0 AFTER discount");
  await ensureColumn("invoices", "payment_status", "VARCHAR(50) DEFAULT 'Pending' AFTER payment_mode");
  await ensureColumn("invoices", "notes", "TEXT NULL AFTER status");
  await ensureColumn("invoices", "items_json", "LONGTEXT NULL AFTER notes");
  await ensureColumn("invoices", "booking_id", "INT DEFAULT NULL AFTER notes");
  await ensureColumn("invoices", "customer_id", "INT DEFAULT NULL AFTER booking_id");
  await ensureColumn("invoices", "total_amount", "DECIMAL(12,2) DEFAULT 0 AFTER final_total");
  await ensureColumn(
    "invoices",
    "updated_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
  );
};

const getBookingInvoiceBase = async (customerId) => {
  const rows = await runQuery(
    `
      SELECT
        g.id AS bookingId,
        g.guest_name AS customerName,
        g.mobile AS phone,
        g.check_in AS checkIn,
        g.check_out AS checkOut,
        g.booking_status AS bookingStatus,
        COALESCE(a.amount, 0) AS paidAmount,
        COALESCE(a.discount_amount, 0) AS advanceDiscount,
        GROUP_CONCAT(DISTINCT CAST(rt.room_number AS CHAR) ORDER BY rt.room_number SEPARATOR ', ') AS roomNumbers
      FROM guests g
      LEFT JOIN advance_payment a ON a.booking_id = g.id
      LEFT JOIN room_tariff rt ON rt.booking_id = g.id
      WHERE g.id = ?
      GROUP BY
        g.id,
        g.guest_name,
        g.mobile,
        g.check_in,
        g.check_out,
        g.booking_status,
        a.amount,
        a.discount_amount
      LIMIT 1
    `,
    [customerId],
  );

  return rows[0] || null;
};

const getRoomItems = async (bookingId, nights = 1) => {
  if (!(await tableExists("room_tariff"))) return [];

  const hasQuantity = await columnExists("room_tariff", "quantity");
  const hasCategoryName = await columnExists("room_tariff", "category_name");

  const rows = await runQuery(
    `
      SELECT
        CAST(room_number AS CHAR) AS roomNumber,
        ${hasCategoryName ? "COALESCE(category_name, 'Room Charge')" : "'Room Charge'"} AS roomType,
        COALESCE(${hasQuantity ? "NULLIF(quantity, 0)" : "1"}, 1) AS quantity,
        COALESCE(tariff, 0) AS price,
        COALESCE(gst, 0) AS gstPercent
      FROM room_tariff
      WHERE booking_id = ?
      ORDER BY room_number
    `,
    [bookingId],
  );

  return rows.map((row) => {
    const quantity = Number(row.quantity || 1);
    const price = Number(row.price || 0);
    const gstPercent = Number(row.gstPercent || 0);
    const perNightBase = price * quantity;
    const perNightGst = (perNightBase * gstPercent) / 100;
    const rowTotal = roundMoney(perNightBase * nights + perNightGst * nights);
    return {
      category: "Hotel",
      name: `${row.roomType} - Room ${row.roomNumber}`,
      price,
      quantity,
      gstPercent,
      nights,
      total: rowTotal,
    };
  });
};

const getFolioItems = async (bookingId) => {
  if (!(await tableExists("hotel_folio_entries"))) return { chargeItems: [], discount: 0 };

  const rows = await runQuery(
    `
      SELECT entry_type, category, description, amount
      FROM hotel_folio_entries
      WHERE booking_id = ?
      ORDER BY entry_date ASC, id ASC
    `,
    [bookingId],
  );

  const chargeItems = [];
  let folioDiscount = 0;

  rows.forEach((row) => {
    const amount = roundMoney(row.amount || 0);
    if (String(row.entry_type || "").toLowerCase() === "discount") {
      folioDiscount += Math.abs(amount);
      return;
    }

    if (["Payment", "Refund"].includes(String(row.entry_type || ""))) {
      return;
    }

    if (["Room Charge", "Extra Charge", "Adjustment"].includes(String(row.entry_type || ""))) {
      chargeItems.push({
        category: "Hotel",
        name: row.description || row.category || row.entry_type || "Hotel Charge",
        price: Math.abs(amount),
        quantity: 1,
        total: Math.abs(amount),
      });
    }
  });

  return { chargeItems, discount: roundMoney(folioDiscount) };
};

const getFoodItems = async (roomNumbers = []) => {
  if (!roomNumbers.length) return [];
  if (!(await tableExists("room_orders")) || !(await tableExists("room_order_items"))) return [];

  const hasStatus = await columnExists("room_orders", "status");
  const placeholders = roomNumbers.map(() => "?").join(", ");
  const statusFilter = hasStatus
    ? "AND LOWER(COALESCE(ro.status, 'pending')) IN ('served', 'paid', 'completed', 'billed')"
    : "";
  const rows = await runQuery(
    `
      SELECT
        ro.roomNumber,
        ${hasStatus ? "ro.status," : "'paid' AS status,"}
        roi.name,
        roi.price,
        roi.quantity
      FROM room_orders ro
      INNER JOIN room_order_items roi ON roi.order_id = ro.id
      WHERE ro.roomNumber IN (${placeholders})
      ${statusFilter}
      ORDER BY ro.id ASC, roi.id ASC
    `,
    roomNumbers,
  );

  return rows
    .filter((row) => Number(row.quantity || 0) > 0 && Number(row.price || 0) > 0)
    .map((row) => {
    const quantity = Number(row.quantity || 1);
    const price = Number(row.price || 0);
    return {
      category: "Food",
      name: `${row.name} - Room ${row.roomNumber}`,
      price,
      quantity,
      total: roundMoney(price * quantity),
    };
    });
};

const saveGeneratedInvoice = async (payload) => {
  await ensureSchema();

  const current = await getLatestInvoiceRow(payload.customerId);

  const invoiceNo = current?.invoice_no || buildInvoiceNo(payload.customerId);
  const paymentStatus = current?.payment_status || current?.status || payload.paymentStatus || "Pending";
  const paymentMode = current?.payment_mode || payload.paymentMode || "Pending";
  const notes = current?.notes || payload.notes || null;

  const values = [
    invoiceNo,
    payload.date,
    payload.customerName,
    payload.phone,
    payload.roomNumber,
    payload.checkIn || null,
    payload.checkOut || null,
    payload.roomCharge,
    payload.foodCharge,
    payload.extraCharge,
    payload.subtotal,
    payload.tax,
    payload.discount,
    payload.totalAmount,
    payload.totalAmount,
    paymentMode,
    paymentStatus,
    paymentStatus,
    notes,
    JSON.stringify(payload.items || []),
    payload.customerId,
    payload.customerId,
  ];

  if (current) {
    await runQuery(
      `
        UPDATE invoices SET
          invoice_no = ?,
          date = ?,
          customer_name = ?,
          phone = ?,
          room_no = ?,
          check_in = ?,
          check_out = ?,
          price_per_day = ?,
          food_charge = ?,
          extra_charge = ?,
          subtotal = ?,
          gst = ?,
          discount = ?,
          final_total = ?,
          total_amount = ?,
          payment_mode = ?,
          payment_status = ?,
          status = ?,
          notes = ?,
          items_json = ?,
          booking_id = ?,
          customer_id = ?
        WHERE id = ?
      `,
      [...values, current.id],
    );
    await removeDuplicateInvoices({
      keepId: current.id,
      bookingId: payload.customerId,
      invoiceNo,
    });
    return { id: current.id, invoiceNo, paymentStatus, paymentMode, notes };
  }

  const result = await runQuery(
    `
      INSERT INTO invoices
      (
        invoice_no, date, customer_name, phone, room_no, check_in, check_out,
        price_per_day, food_charge, extra_charge, subtotal, gst, discount,
        final_total, total_amount, payment_mode, payment_status, status,
        notes, items_json, booking_id, customer_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    values,
  );

  await removeDuplicateInvoices({
    keepId: result.insertId,
    bookingId: payload.customerId,
    invoiceNo,
  });

  return { id: result.insertId, invoiceNo, paymentStatus, paymentMode, notes };
};

const buildInvoicePayload = async (customerId) => {
  const booking = await getBookingInvoiceBase(customerId);
  if (!booking) {
    throw new Error("Customer not found");
  }

  const roomNumbers = String(booking.roomNumbers || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // Calculate nights from check-in / check-out (same logic as bookingController.js)
  const nights = (() => {
    if (booking.checkIn && booking.checkOut) {
      const d1 = new Date(booking.checkIn);
      const d2 = new Date(booking.checkOut);
      const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 1;
    }
    return 1;
  })();

  const roomItems = await getRoomItems(customerId, nights);
  const folioData = await getFolioItems(customerId);
  const foodItems = await getFoodItems(roomNumbers);

  const items = [...roomItems, ...folioData.chargeItems, ...foodItems];
  const subtotal = roundMoney(items.reduce((sum, item) => sum + Number(item.total || 0), 0));
  const tax = roundMoney(subtotal * GST_RATE);
  const discount = roundMoney(Number(booking.advanceDiscount || 0) + Number(folioData.discount || 0));
  const totalAmount = roundMoney(subtotal + tax - discount);
  const roomCharge = roundMoney(
    [...roomItems, ...folioData.chargeItems]
      .filter((item) => item.category === "Hotel")
      .reduce((sum, item) => sum + Number(item.total || 0), 0),
  );
  const foodCharge = roundMoney(
    foodItems.reduce((sum, item) => sum + Number(item.total || 0), 0),
  );

  const saved = await saveGeneratedInvoice({
    customerId,
    date: formatDateKey(new Date()),
    customerName: booking.customerName || "Walk-in Guest",
    phone: booking.phone || "",
    roomNumber: roomNumbers.join(", "),
    checkIn: formatDateKey(booking.checkIn),
    checkOut: formatDateKey(booking.checkOut),
    roomCharge,
    foodCharge,
    extraCharge: roundMoney(folioData.chargeItems.reduce((sum, item) => sum + Number(item.total || 0), 0)),
    subtotal,
    tax,
    discount,
    totalAmount,
    paymentMode: Number(booking.paidAmount || 0) > 0 ? "Mixed / Recorded" : "Pending",
    paymentStatus: totalAmount > Number(booking.paidAmount || 0) ? "Pending" : "Paid",
    items,
    notes: `Auto-generated combined invoice for booking #${customerId}`,
  });

  return {
    id: saved.id,
    customerId: Number(customerId),
    bookingId: Number(customerId),
    invoiceNo: saved.invoiceNo,
    customerName: booking.customerName || "Walk-in Guest",
    phone: booking.phone || "",
    roomNumber: roomNumbers.join(", "),
    items,
    subtotal,
    tax,
    discount,
    totalAmount,
    paidAmount: Number(booking.paidAmount || 0),
    balanceDue: Number(totalAmount) - Number(booking.paidAmount || 0),
    date: formatDateKey(new Date()),
    checkIn: formatDateKey(booking.checkIn),
    checkOut: formatDateKey(booking.checkOut),
    paymentMode: saved.paymentMode,
    paymentStatus: saved.paymentStatus,
    roomCharge,
    foodCharge,
    bookingStatus: booking.bookingStatus || "Confirmed",
  };
};

const parseInvoiceRow = (row) => ({
  ...row,
  items: (() => {
    try {
      return JSON.parse(row.items_json || "[]");
    } catch {
      return [];
    }
  })(),
  // 🐛 FIX: this used to only spread the raw DB row (snake_case columns:
  // invoice_no, booking_id, room_no, check_in, check_out, customer_name,
  // etc.) without ever mapping them to the camelCase names every consumer
  // actually reads (invoiceNo, bookingId, roomNumber, checkIn, checkOut,
  // customerName...). A brand-new invoice (built via generateCustomerInvoice)
  // already returns camelCase fields directly, so it looked fine the first
  // time — but any time an EXISTING invoice was reused (getInvoiceByBookingId,
  // which is the normal path once an invoice already exists for a booking),
  // `invoice.invoiceNo` and `invoice.bookingId` came back undefined, which is
  // why "Invoice No." and "Folio No." on the printed/WhatsApp'd invoice
  // showed blank/N-A after the first send.
  invoiceNo: row.invoiceNo || row.invoice_no || "",
  bookingId: row.bookingId ?? row.booking_id ?? row.customer_id ?? null,
  customerName: row.customerName || row.customer_name || "",
  phone: row.phone || "",
  roomNumber: row.roomNumber || row.room_no || "",
  checkIn: row.checkIn || row.check_in || "",
  checkOut: row.checkOut || row.check_out || "",
  paymentMode: row.paymentMode || row.payment_mode || "",
  paymentStatus: row.payment_status || row.status || "Pending",
  totalAmount: Number(row.total_amount ?? row.final_total ?? 0),
  subtotal: Number(row.subtotal || 0),
  tax: Number(row.gst || 0),
  discount: Number(row.discount || 0),
  paidAmount: Number(row.paidAmount || 0),
});

const createInvoice = (data, callback) => {
  ensureSchema()
    .then(() =>
      runQuery(
        `
          INSERT INTO invoices
          (
            invoice_no, date, customer_name, phone, room_no, check_in, check_out,
            price_per_day, food_charge, extra_charge, subtotal, gst, discount,
            final_total, total_amount, payment_mode, payment_status, status,
            notes, items_json, booking_id, customer_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          data.invoiceNo,
          data.date,
          data.customerName,
          data.phone,
          data.roomNo,
          data.checkIn,
          data.checkOut,
          data.pricePerDay || 0,
          data.foodCharge || 0,
          data.extraCharge || 0,
          data.subtotal || 0,
          data.gst || data.tax || 0,
          data.discount || 0,
          data.finalTotal || data.totalAmount || 0,
          data.totalAmount || data.finalTotal || 0,
          data.paymentMode || null,
          data.paymentStatus || data.status || "Pending",
          data.status || data.paymentStatus || "Pending",
          data.notes || null,
          JSON.stringify(data.items || []),
          data.bookingId || null,
          data.customerId || data.bookingId || null,
        ],
      ),
    )
    .then((result) => callback(null, result))
    .catch((error) => callback(error));
};

const getAllInvoices = (callback) => {
  ensureSchema()
    .then(() => {
      const hasAdvanceTable = tableExists("advance_payment");
      if (!hasAdvanceTable) {
        return runQuery(`
          SELECT *
          FROM invoices
          ORDER BY updated_at DESC, id DESC
        `);
      }

      return runQuery(`
        SELECT
          i.*,
          COALESCE(SUM(a.amount), 0) AS paidAmount,
          COALESCE(SUM(a.discount_amount), 0) AS advanceDiscount
        FROM invoices i
        LEFT JOIN advance_payment a ON a.booking_id = i.booking_id
        GROUP BY i.id
        ORDER BY i.updated_at DESC, i.id DESC
      `);
    })
    .then((rows) => callback(null, dedupeInvoiceRows(rows).map(parseInvoiceRow)))
    .catch((error) => callback(error));
};

const getInvoiceByBookingId = (bookingId, callback) => {
  if (typeof callback === 'function') {
    ensureSchema()
      .then(() =>
        runQuery(
          `
            SELECT *
            FROM invoices
            WHERE booking_id = ? OR customer_id = ?
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          `,
          [bookingId, bookingId],
        ),
      )
      .then((rows) => callback(null, rows[0] ? parseInvoiceRow(rows[0]) : null))
      .catch((error) => callback(error));
    return;
  }

  // async/await mode — called as: await Invoice.getInvoiceByBookingId(bookingId)
  return (async () => {
    await ensureSchema();
    const rows = await runQuery(
      `
        SELECT *
        FROM invoices
        WHERE booking_id = ? OR customer_id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      [bookingId, bookingId],
    );
    return rows[0] ? parseInvoiceRow(rows[0]) : null;
  })();
};

const updateInvoice = (id, data, callback) => {
  ensureSchema()
    .then(() =>
      runQuery(
        `
          UPDATE invoices SET
            date = ?,
            customer_name = ?,
            phone = ?,
            room_no = ?,
            check_in = ?,
            check_out = ?,
            price_per_day = ?,
            food_charge = ?,
            extra_charge = ?,
            subtotal = ?,
            gst = ?,
            discount = ?,
            final_total = ?,
            total_amount = ?,
            payment_mode = ?,
            payment_status = ?,
            status = ?,
            notes = ?,
            items_json = ?
          WHERE id = ?
        `,
        [
          data.date,
          data.customerName,
          data.phone,
          data.roomNo,
          data.checkIn,
          data.checkOut,
          data.pricePerDay || 0,
          data.foodCharge || 0,
          data.extraCharge || 0,
          data.subtotal || 0,
          data.gst || data.tax || 0,
          data.discount || 0,
          data.finalTotal || data.totalAmount || 0,
          data.totalAmount || data.finalTotal || 0,
          data.paymentMode || null,
          data.paymentStatus || data.status || "Pending",
          data.status || data.paymentStatus || "Pending",
          data.notes || null,
          JSON.stringify(data.items || []),
          id,
        ],
      ),
    )
    .then((result) => callback(null, result))
    .catch((error) => callback(error));
};

const generateCustomerInvoice = async (customerId) => {
  await ensureSchema();
  return buildInvoicePayload(Number(customerId));
};

const updatePaymentStatus = async (id, paymentStatus, options = {}) => {
  await ensureSchema();
  const paymentMode = options.paymentMode || null;
  const notes = options.notes || null;
  await runQuery(
    `
      UPDATE invoices
      SET
        payment_status = ?,
        status = ?,
        payment_mode = COALESCE(?, payment_mode),
        notes = CASE
          WHEN ? IS NULL OR ? = '' THEN notes
          WHEN notes IS NULL OR notes = '' THEN ?
          ELSE CONCAT(notes, ' | ', ?)
        END
      WHERE id = ?
    `,
    [paymentStatus, paymentStatus, paymentMode, notes, notes, notes, notes, id],
  );
};

module.exports = {
  ensureSchema,
  createInvoice,
  getAllInvoices,
  getInvoiceByBookingId,
  updateInvoice,
  generateCustomerInvoice,
  updatePaymentStatus,
};