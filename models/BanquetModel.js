const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const DEFAULT_BANQUET_PRICING_CONFIG = {
  menuPackages: [
    {
      id: "standard",
      name: "Standard Celebration",
      perGuest: 650,
      mealLabel: "Veg buffet + snacks",
      description:
        "Budget-friendly family functions ke liye balanced buffet plan.",
      highlights: [
        "Welcome drinks aur 2 starter options",
        "2 veg sabzi, dal, rice aur breads",
        "1 dessert aur standard service setup",
      ],
    },
    {
      id: "premium",
      name: "Premium Feast",
      perGuest: 950,
      mealLabel: "Veg + live counter",
      description:
        "Engagement aur reception events ke liye richer spread with live counter.",
      highlights: [
        "Mocktail station aur 3 premium starters",
        "Paneer specialty, main course buffet aur salads",
        "Live counter plus 2 dessert selections",
      ],
    },
    {
      id: "royal",
      name: "Royal Signature",
      perGuest: 1250,
      mealLabel: "Full event dining experience",
      description:
        "Large-format celebrations ke liye signature dining experience.",
      highlights: [
        "Grand welcome beverages aur chef-curated starters",
        "Multi-cuisine main course with live counter access",
        "Premium desserts, service crew aur elegant presentation",
      ],
    },
  ],
  lightingOptions: [
    { id: "classic", label: "Classic", price: 8000 },
    { id: "stage", label: "Stage Focus", price: 15000 },
    { id: "premium", label: "Premium Intelligent", price: 28000 },
  ],
  mealSectionPrices: {
    "Welcome Drinks": 60,
    Starters: 140,
    "Main Course": 260,
    "Live Counter": 220,
    Desserts: 120,
  },
  eventSupportFee: 12000,
  decorServiceFee: 15000,
};

const hasColumn = async (tableName, columnName) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return rows.length > 0;
};

const ensureColumn = async (tableName, columnName, definition) => {
  if (await hasColumn(tableName, columnName)) return;
  try {
    await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  } catch (error) {
    if (error?.code === "ER_DUP_FIELDNAME") return;
    throw error;
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS banquet_halls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      capacity INT NOT NULL DEFAULT 0,
      rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_ac TINYINT(1) NOT NULL DEFAULT 0,
      image VARCHAR(255) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Available'
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS banquet_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hall_id INT NOT NULL,
      customer_name VARCHAR(191) NOT NULL,
      phone VARCHAR(50) DEFAULT '',
      guest_email VARCHAR(191) DEFAULT '',
      event_title VARCHAR(191) DEFAULT '',
      event_type VARCHAR(100) NOT NULL,
      guests INT NOT NULL DEFAULT 0,
      menu_package_id VARCHAR(100) DEFAULT 'standard',
      meal_section VARCHAR(100) DEFAULT '',
      custom_menu_items TEXT DEFAULT NULL,
      lighting_system VARCHAR(100) DEFAULT 'classic',
      decoration_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT NULL,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst_percent DECIMAL(10,2) NOT NULL DEFAULT 5,
      invoice_no VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'Confirmed',
      advance DECIMAL(10,2) NOT NULL DEFAULT 0
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS banquet_pricing_config (
      id INT PRIMARY KEY,
      config_json LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("banquet_halls", "image", "VARCHAR(255) DEFAULT NULL");

  await ensureColumn("banquet_bookings", "customer_name", "VARCHAR(191) NOT NULL DEFAULT ''");
  await ensureColumn("banquet_bookings", "phone", "VARCHAR(50) DEFAULT ''");
  await ensureColumn("banquet_bookings", "guest_email", "VARCHAR(191) DEFAULT ''");
  await ensureColumn("banquet_bookings", "event_title", "VARCHAR(191) DEFAULT ''");
  await ensureColumn("banquet_bookings", "guests", "INT NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "menu_package_id", "VARCHAR(100) DEFAULT 'standard'");
  await ensureColumn("banquet_bookings", "meal_section", "VARCHAR(100) DEFAULT ''");
  await ensureColumn("banquet_bookings", "custom_menu_items", "TEXT DEFAULT NULL");
  await ensureColumn("banquet_bookings", "lighting_system", "VARCHAR(100) DEFAULT 'classic'");
  await ensureColumn("banquet_bookings", "decoration_fee", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "event_support_fee", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "lighting_charge", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "custom_menu_charge", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "hall_charge", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "meal_charge", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "date", "DATE DEFAULT NULL");
  await ensureColumn("banquet_bookings", "discount", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "gst_percent", "DECIMAL(10,2) NOT NULL DEFAULT 5");
  await ensureColumn("banquet_bookings", "subtotal_amount", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "gst_amount", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "grand_total", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "invoice_no", "VARCHAR(100) DEFAULT NULL");
  await ensureColumn("banquet_bookings", "advance", "DECIMAL(10,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "refund_amount", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "net_received", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "balance_due", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await ensureColumn("banquet_bookings", "payment_mode", "VARCHAR(50) DEFAULT NULL");
  await ensureColumn("banquet_bookings", "payment_status", "VARCHAR(50) NOT NULL DEFAULT 'Pending'");
  await ensureColumn("banquet_bookings", "payment_reference_no", "VARCHAR(120) DEFAULT NULL");
  await ensureColumn("banquet_bookings", "billed_at", "DATETIME DEFAULT NULL");

  const hasGuestName = await hasColumn("banquet_bookings", "guest_name");
  const hasMobile = await hasColumn("banquet_bookings", "mobile");
  const hasEventDate = await hasColumn("banquet_bookings", "event_date");
  const hasGuestCount = await hasColumn("banquet_bookings", "guest_count");
  const hasAdvancePaid = await hasColumn("banquet_bookings", "advance_paid");

  if (hasGuestName) {
    await runQuery(`
      UPDATE banquet_bookings
      SET customer_name = COALESCE(NULLIF(customer_name, ''), guest_name, '')
      WHERE customer_name IS NULL OR customer_name = ''
    `);
  }

  if (hasMobile) {
    await runQuery(`
      UPDATE banquet_bookings
      SET phone = COALESCE(NULLIF(phone, ''), mobile, '')
      WHERE phone IS NULL OR phone = ''
    `);
  }

  if (hasEventDate) {
    await runQuery(`
      UPDATE banquet_bookings
      SET date = COALESCE(date, event_date)
      WHERE date IS NULL
    `);
  }

  if (hasGuestCount) {
    await runQuery(`
      UPDATE banquet_bookings
      SET guests = CASE
        WHEN COALESCE(guests, 0) = 0 THEN COALESCE(guest_count, 0)
        ELSE guests
      END
    `);
  }

  if (hasAdvancePaid) {
    await runQuery(`
      UPDATE banquet_bookings
      SET advance = CASE
        WHEN COALESCE(advance, 0) = 0 THEN COALESCE(advance_paid, 0)
        ELSE advance
      END
    `);
  }

  if (await hasColumn("banquet_bookings", "total_amount")) {
    await runQuery(`
      UPDATE banquet_bookings
      SET grand_total = CASE
        WHEN COALESCE(grand_total, 0) = 0 THEN COALESCE(total_amount, 0)
        ELSE grand_total
      END,
      balance_due = CASE
        WHEN COALESCE(balance_due, 0) = 0
          THEN GREATEST(
            0,
            COALESCE(
              NULLIF(grand_total, 0),
              total_amount,
              0
            ) - COALESCE(advance, 0) + COALESCE(refund_amount, 0)
          )
        ELSE balance_due
      END,
      net_received = CASE
        WHEN COALESCE(net_received, 0) = 0
          THEN GREATEST(0, COALESCE(advance, 0) - COALESCE(refund_amount, 0))
        ELSE net_received
      END,
      payment_status = CASE
        WHEN LOWER(COALESCE(payment_status, 'pending')) NOT IN ('pending', 'partial', 'paid', 'refunded')
          THEN 'Pending'
        WHEN COALESCE(grand_total, total_amount, 0) > 0
          AND GREATEST(0, COALESCE(advance, 0) - COALESCE(refund_amount, 0)) >= COALESCE(grand_total, total_amount, 0)
          THEN 'Paid'
        WHEN GREATEST(0, COALESCE(advance, 0) - COALESCE(refund_amount, 0)) > 0
          THEN 'Partial'
        ELSE COALESCE(payment_status, 'Pending')
      END
    `);
  }

  await runQuery(
    `
    INSERT INTO banquet_pricing_config (id, config_json)
    VALUES (1, ?)
    ON DUPLICATE KEY UPDATE config_json = COALESCE(config_json, VALUES(config_json))
    `,
    [JSON.stringify(DEFAULT_BANQUET_PRICING_CONFIG)]
  );
};

const getAllHalls = async () => {
  const rows = await runQuery(`
    SELECT 
      id,
      name,
      capacity,
      rate_per_hour AS ratePerHour,
      is_ac,
      image,
      status
    FROM banquet_halls
    ORDER BY id DESC
  `);

  return rows;
};

const createHall = async ({ name, capacity, ratePerHour, is_ac, image }) => {
  const result = await runQuery(
    `
    INSERT INTO banquet_halls (
      name,
      capacity,
      rate_per_hour,
      is_ac,
      image,
      status
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [name, Number(capacity), Number(ratePerHour), is_ac ? 1 : 0, image || null, "Available"],
  );

  const rows = await runQuery("SELECT * FROM banquet_halls WHERE id = ?", [result.insertId]);
  return rows[0];
};

const getAllBookings = async () => {
  const rows = await runQuery(`
    SELECT
      b.id,
      b.hall_id,
      h.name AS hallName,
      b.customer_name,
      b.phone,
      b.guest_email,
      b.event_title,
      b.event_type,
      b.guests,
      b.menu_package_id,
      b.meal_section,
      b.custom_menu_items,
      b.lighting_system,
      b.decoration_fee,
      b.notes,
      b.date,
      b.start_time,
      b.end_time,
      b.discount,
      b.gst_percent,
      b.invoice_no,
      b.status,
      b.advance
    FROM banquet_bookings b
    JOIN banquet_halls h ON b.hall_id = h.id
    ORDER BY b.id DESC
  `);

  return rows;
};

const checkHallBookingConflict = async ({ hallId, date, startTime, endTime }) => {
  const rows = await runQuery(
    `
    SELECT id
    FROM banquet_bookings
    WHERE hall_id = ?
      AND date = ?
      AND status IN ('Confirmed', 'Completed', 'Billed')
      AND (start_time < ? AND end_time > ?)
    `,
    [hallId, date, endTime, startTime],
  );

  return rows;
};

const createBooking = async (data) => {
  const result = await runQuery(
    `
    INSERT INTO banquet_bookings (
      hall_id,
      customer_name,
      phone,
      guest_email,
      event_title,
      event_type,
      guests,
      menu_package_id,
      meal_section,
      custom_menu_items,
      lighting_system,
      decoration_fee,
      notes,
      date,
      start_time,
      end_time,
      discount,
      gst_percent,
      invoice_no,
      status,
      advance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.hallId,
      data.customerName,
      data.phone || "",
      data.guestEmail || "",
      data.eventTitle || "",
      data.eventType,
      Number(data.guests || 0),
      data.menuPackageId || "standard",
      data.mealSection || "",
      data.customMenuItems || "",
      data.lightingSystem || "classic",
      Number(data.decorationFee || 0),
      data.notes || "",
      data.date,
      data.startTime,
      data.endTime,
      Number(data.discount || 0),
      Number(data.gstPercent || 5),
      data.invoiceNo || "",
      "Confirmed",
      Number(data.advance || 0),
    ],
  );

  return result.insertId;
};

const updateBookingStatus = async (id, status) => {
  const result = await runQuery("UPDATE banquet_bookings SET status = ? WHERE id = ?", [status, id]);
  return result;
};

const updateBookingBill = async (id, invoiceNo) => {
  const result = await runQuery(
    "UPDATE banquet_bookings SET invoice_no = ?, status = 'Billed' WHERE id = ?",
    [invoiceNo, id],
  );
  return result;
};

module.exports = {
  DEFAULT_BANQUET_PRICING_CONFIG,
  ensureSchema,
  getAllHalls,
  createHall,
  getAllBookings,
  checkHallBookingConflict,
  createBooking,
  updateBookingStatus,
  updateBookingBill,
};
