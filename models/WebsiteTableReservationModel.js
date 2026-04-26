const db = require("../config/db");

const dbPromise = db.promise();
const TABLE_NAME = "website_table_reservations";

const ensureColumn = async (columnName, definition) => {
  const [rows] = await dbPromise.query(`SHOW COLUMNS FROM ${TABLE_NAME} LIKE ?`, [columnName]);
  if (!rows.length) {
    await dbPromise.query(`ALTER TABLE ${TABLE_NAME} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureIndex = async (indexName, definition) => {
  const [rows] = await dbPromise.query(`SHOW INDEX FROM ${TABLE_NAME} WHERE Key_name = ?`, [indexName]);
  if (!rows.length) {
    await dbPromise.query(`ALTER TABLE ${TABLE_NAME} ADD ${definition}`);
  }
};







async function ensureSchema() {
  await dbPromise.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reservation_code VARCHAR(50) DEFAULT NULL UNIQUE,
      customer_name VARCHAR(191) NOT NULL,
      mobile VARCHAR(50) NOT NULL,
      email VARCHAR(191) DEFAULT NULL,
      reservation_date DATE NOT NULL,
      time_slot VARCHAR(100) NOT NULL,
      guest_count INT NOT NULL DEFAULT 1,
      table_preference VARCHAR(100) DEFAULT NULL,
      occasion VARCHAR(100) DEFAULT NULL,
      special_request TEXT DEFAULT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Pending',
      source VARCHAR(40) NOT NULL DEFAULT 'website',
      assigned_table_id INT DEFAULT NULL,
      assigned_table_number VARCHAR(50) DEFAULT NULL,
      confirmed_by VARCHAR(191) DEFAULT NULL,
      confirmed_at DATETIME DEFAULT NULL,
      cancelled_at DATETIME DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      paymentMethod VARCHAR(50) DEFAULT NULL,
      paymentStatus VARCHAR(50) DEFAULT NULL,
      paymentAmount DECIMAL(10,2) DEFAULT NULL,
      hold_expires_at DATETIME DEFAULT NULL,
      razorpayOrderId VARCHAR(255) DEFAULT NULL,
      razorpayPaymentId VARCHAR(255) DEFAULT NULL,
      paidAt DATETIME DEFAULT NULL
    )
  `);

  await ensureColumn("reservation_code", "VARCHAR(50) DEFAULT NULL UNIQUE AFTER id");
  await ensureColumn("email", "VARCHAR(191) DEFAULT NULL AFTER mobile");
  await ensureColumn("table_preference", "VARCHAR(100) DEFAULT NULL AFTER guest_count");
  await ensureColumn("occasion", "VARCHAR(100) DEFAULT NULL AFTER table_preference");
  await ensureColumn("special_request", "TEXT DEFAULT NULL AFTER occasion");
  await ensureColumn("status", "VARCHAR(40) NOT NULL DEFAULT 'Pending' AFTER special_request");
  await ensureColumn("source", "VARCHAR(40) NOT NULL DEFAULT 'website' AFTER status");
  await ensureColumn("assigned_table_id", "INT DEFAULT NULL AFTER source");
  await ensureColumn("assigned_table_number", "VARCHAR(50) DEFAULT NULL AFTER assigned_table_id");
  await ensureColumn("confirmed_by", "VARCHAR(191) DEFAULT NULL AFTER assigned_table_number");
  await ensureColumn("confirmed_at", "DATETIME DEFAULT NULL AFTER confirmed_by");
  await ensureColumn("cancelled_at", "DATETIME DEFAULT NULL AFTER confirmed_at");
  await ensureColumn("notes", "TEXT DEFAULT NULL AFTER cancelled_at");
  await ensureColumn(
    "updated_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
  );

  await ensureIndex(
    "idx_web_table_reservation_lookup",
    "INDEX idx_web_table_reservation_lookup (reservation_date, time_slot, status)",
  );
  await ensureIndex(
    "idx_web_table_reservation_mobile",
    "INDEX idx_web_table_reservation_mobile (mobile)",
  );


await ensureColumn("paymentMethod", "VARCHAR(50) NULL AFTER updated_at");
await ensureColumn("paymentStatus", "VARCHAR(50) NULL AFTER paymentMethod");
await ensureColumn("paymentAmount", "DECIMAL(10,2) NULL AFTER paymentStatus");
await ensureColumn("hold_expires_at", "DATETIME NULL AFTER paymentAmount");
await ensureColumn("razorpayOrderId", "VARCHAR(255) NULL AFTER paymentAmount");
await ensureColumn("razorpayPaymentId", "VARCHAR(255) NULL AFTER razorpayOrderId");
await ensureColumn("paidAt", "DATETIME NULL AFTER razorpayPaymentId");

  await ensureIndex(
    "idx_web_table_reservation_code",
    "INDEX idx_web_table_reservation_code (reservation_code)",
  );
  await ensureIndex(
    "idx_web_table_reservation_payment_order",
    "INDEX idx_web_table_reservation_payment_order (razorpayOrderId)",
  );
  await ensureIndex(
    "idx_web_table_reservation_payment_status",
    "INDEX idx_web_table_reservation_payment_status (paymentStatus)",
  );
  await ensureIndex(
    "idx_web_table_slot_lookup",
    "INDEX idx_web_table_slot_lookup (reservation_date, time_slot, status, assigned_table_id)",
  );







}


async function updatePaymentOrder(id, data) {
  await ensureSchema();

  await dbPromise.query(
    `
      UPDATE ${TABLE_NAME}
      SET
        paymentMethod = ?,
        paymentStatus = ?,
        paymentAmount = ?,
        razorpayOrderId = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
    [
      data.paymentMethod || null,
      data.paymentStatus || null,
      data.paymentAmount ?? null,
      data.razorpayOrderId || null,
      id,
    ],
  );
}

async function markReservationPaymentSuccess(id, data) {
  await ensureSchema();

  await dbPromise.query(
    `
      UPDATE ${TABLE_NAME}
      SET
        paymentMethod = ?,
        paymentStatus = ?,
        razorpayOrderId = ?,
        razorpayPaymentId = ?,
        paidAt = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
    [
      data.paymentMethod || null,
      data.paymentStatus || null,
      data.razorpayOrderId || null,
      data.razorpayPaymentId || null,
      data.paidAt || null,
      id,
    ],
  );
}




async function createReservation(data) {
  await ensureSchema();

  const [result] = await dbPromise.query(
    `
      INSERT INTO ${TABLE_NAME}
      (customer_name, mobile, email, reservation_date, time_slot, guest_count, table_preference, occasion, special_request, status, source, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'website', ?)
    `,
    [
      data.customerName,
      data.mobile,
      data.email || null,
      data.reservationDate,
      data.timeSlot,
      Number(data.guestCount || 1),
      data.tablePreference || null,
      data.occasion || null,
      data.specialRequest || null,
      data.status || "Pending",
      data.notes || null,
    ],
  );

  return result;
}

async function updateReservationCode(id, reservationCode) {
  await dbPromise.query(
    `UPDATE ${TABLE_NAME} SET reservation_code = ? WHERE id = ?`,
    [reservationCode, id],
  );
}

async function getReservationByCode(code) {
  await ensureSchema();

  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        reservation_code AS reservationCode,
        customer_name AS customerName,
        mobile,
        email,
        reservation_date AS reservationDate,
        time_slot AS timeSlot,
        guest_count AS guestCount,
        table_preference AS tablePreference,
        occasion,
        special_request AS specialRequest,
        status,
        source,
        assigned_table_id AS assignedTableId,
        assigned_table_number AS assignedTableNumber,
        confirmed_by AS confirmedBy,
        confirmed_at AS confirmedAt,
        cancelled_at AS cancelledAt,
        notes,
        paymentMethod,
        paymentStatus,
        paymentAmount,
        razorpayOrderId,
        razorpayPaymentId,
        paidAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ${TABLE_NAME}
      WHERE reservation_code = ?
      LIMIT 1
    `,
    [code],
  );

  return rows[0] || null;
}

async function getReservationById(id) {
  await ensureSchema();

  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        reservation_code AS reservationCode,
        customer_name AS customerName,
        mobile,
        email,
        reservation_date AS reservationDate,
        time_slot AS timeSlot,
        guest_count AS guestCount,
        table_preference AS tablePreference,
        occasion,
        special_request AS specialRequest,
        status,
        source,
        assigned_table_id AS assignedTableId,
        assigned_table_number AS assignedTableNumber,
        confirmed_by AS confirmedBy,
        confirmed_at AS confirmedAt,
        cancelled_at AS cancelledAt,
        notes,
        paymentMethod,
        paymentStatus,
        paymentAmount,
        razorpayOrderId,
        razorpayPaymentId,
        paidAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ${TABLE_NAME}
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
}

async function getAllReservations(filters = {}) {
  await ensureSchema();

  const conditions = [];
  const params = [];

  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  if (filters.reservationDate) {
    conditions.push("reservation_date = ?");
    params.push(filters.reservationDate);
  }

  if (filters.mobile) {
    conditions.push("mobile = ?");
    params.push(filters.mobile);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        reservation_code AS reservationCode,
        customer_name AS customerName,
        mobile,
        email,
        reservation_date AS reservationDate,
        time_slot AS timeSlot,
        guest_count AS guestCount,
        table_preference AS tablePreference,
        occasion,
        special_request AS specialRequest,
        status,
        source,
        assigned_table_id AS assignedTableId,
        assigned_table_number AS assignedTableNumber,
        confirmed_by AS confirmedBy,
        confirmed_at AS confirmedAt,
        cancelled_at AS cancelledAt,
        notes,
        paymentMethod,
        paymentStatus,
        paymentAmount,
        razorpayOrderId,
        razorpayPaymentId,
        paidAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ${TABLE_NAME}
      ${whereClause}
      ORDER BY reservation_date DESC, created_at DESC, id DESC
    `,
    params,
  );

  return rows;
}

async function findDuplicateCandidate(data) {
  await ensureSchema();

  const [rows] = await dbPromise.query(
    `
      SELECT id, reservation_code AS reservationCode, status
      FROM ${TABLE_NAME}
      WHERE mobile = ?
        AND reservation_date = ?
        AND time_slot = ?
        AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'completed', 'no show')
      ORDER BY id DESC
      LIMIT 1
    `,
    [data.mobile, data.reservationDate, data.timeSlot],
  );

  return rows[0] || null;
}

async function countReservationsForSlot({ reservationDate, timeSlot }) {
  await ensureSchema();

  const [rows] = await dbPromise.query(
    `
      SELECT
        COUNT(*) AS reservationCount,
        COALESCE(SUM(guest_count), 0) AS guestCount
      FROM ${TABLE_NAME}
      WHERE reservation_date = ?
        AND time_slot = ?
        AND LOWER(COALESCE(status, '')) IN ('pending', 'confirmed', 'seated')
    `,
    [reservationDate, timeSlot],
  );

  return {
    reservationCount: Number(rows[0]?.reservationCount || 0),
    guestCount: Number(rows[0]?.guestCount || 0),
  };
}

async function updateReservationStatus(id, payload = {}) {
  await ensureSchema();

  const fields = [];
  const values = [];

  if (payload.status !== undefined) {
    fields.push("status = ?");
    values.push(payload.status);
  }

  if (payload.confirmedBy !== undefined) {
    fields.push("confirmed_by = ?");
    values.push(payload.confirmedBy || null);
  }

  if (payload.confirmedAt !== undefined) {
    fields.push("confirmed_at = ?");
    values.push(payload.confirmedAt || null);
  }

  if (payload.cancelledAt !== undefined) {
    fields.push("cancelled_at = ?");
    values.push(payload.cancelledAt || null);
  }

  if (payload.notes !== undefined) {
    fields.push("notes = ?");
    values.push(payload.notes || null);
  }

  if (!fields.length) {
    return;
  }

  values.push(id);
  await dbPromise.query(`UPDATE ${TABLE_NAME} SET ${fields.join(", ")} WHERE id = ?`, values);
}

async function assignTable(id, payload = {}) {
  await ensureSchema();

  await dbPromise.query(
    `
      UPDATE ${TABLE_NAME}
      SET assigned_table_id = ?, assigned_table_number = ?, notes = COALESCE(?, notes)
      WHERE id = ?
    `,
    [
      payload.assignedTableId || null,
      payload.assignedTableNumber || null,
      payload.notes !== undefined ? payload.notes : null,
      id,
    ],
  );
}

async function findRestaurantTableById(tableId) {
  const [rows] = await dbPromise.query(
    `
      SELECT
        id,
        number,
        seat_count AS seatCount,
        status
      FROM restaurant_tables
      WHERE id = ?
      LIMIT 1
    `,
    [tableId],
  );

  return rows[0] || null;
}

async function getAvailableRestaurantTables(filters = {}) {
  await ensureSchema();

  const reservationDate = String(filters.reservationDate || "").trim();
  const timeSlot = String(filters.timeSlot || "").trim();
  const guestCount = Number(filters.guestCount || 1);
  const category = String(filters.category || "").trim();

  const conditions = [
    "LOWER(COALESCE(rt.status, 'available')) = 'available'",
    "COALESCE(rt.seat_count, 0) >= ?",
  ];
  const params = [guestCount];

  if (category) {
    conditions.push("LOWER(COALESCE(rt.category, '')) = LOWER(?)");
    params.push(category);
  }

  if (reservationDate && timeSlot) {
    conditions.push(`
      rt.id NOT IN (
        SELECT wtr.assigned_table_id
        FROM ${TABLE_NAME} wtr
        WHERE wtr.reservation_date = ?
          AND wtr.time_slot = ?
          AND LOWER(COALESCE(wtr.status, '')) IN ('held', 'pending', 'confirmed', 'seated')
          AND (
            LOWER(COALESCE(wtr.status, '')) <> 'held'
            OR wtr.hold_expires_at IS NULL
            OR wtr.hold_expires_at > NOW()
          )
          AND wtr.assigned_table_id IS NOT NULL
      )
    `);
    params.push(reservationDate, timeSlot);
  }

  const [rows] = await dbPromise.query(
    `
      SELECT
        rt.id,
        rt.number,
        rt.category,
        rt.guestCount,
        rt.floor_name AS floorName,
        rt.section_name AS sectionName,
        rt.seat_count AS seatCount,
        rt.status_color AS statusColor,
        rt.status
      FROM restaurant_tables rt
      WHERE ${conditions.join("\n        AND ")}
      ORDER BY CAST(rt.number AS UNSIGNED), rt.number ASC
    `,
    params,
  );

  return rows;
}

module.exports = {
  ensureSchema,
  createReservation,
  updateReservationCode,
  getReservationByCode,
  getReservationById,
  getAllReservations,
  findDuplicateCandidate,
  countReservationsForSlot,
  updateReservationStatus,
  assignTable,
  findRestaurantTableById,
  getAvailableRestaurantTables,
  updatePaymentOrder,
  markReservationPaymentSuccess,




};
