/**
 * Dining / Table-Reservation Controller
 *
 * Mounted at /api/web/dining in the backend, so the public paths are:
 *   GET    /api/web/dining/config
 *   GET    /api/web/dining/availability
 *   POST   /api/web/dining/reservations
 *   GET    /api/web/dining/reservations/:code
 *   PATCH  /api/web/dining/reservations/:code/cancel
 *   GET    /api/web/dining/admin/reservations
 *   PATCH  /api/web/dining/admin/reservations/:id/confirm
 *   PATCH  /api/web/dining/admin/reservations/:id/assign-table
 *   PATCH  /api/web/dining/admin/reservations/:id/seat
 *   PATCH  /api/web/dining/admin/reservations/:id/no-show
 */

const db = require("../config/db");


/* ─── Helpers ─────────────────────────────────────────────────────────────── */

// v4 has no dedicated table-reservation table. Web dining reservations are
// stored on the master `bookings` table (guest details in booking_guests,
// dining-specific attributes packed into bookings.special_requests), and the
// unique `booking_code` doubles as the public reservation code.
const DINING_STATUS_TO_BOOKING = {
  pending: "inquiry",
  confirmed: "confirmed",
  assigned: "reserved",
  seated: "checked_in",
  completed: "checked_out",
  cancelled: "cancelled",
  "no-show": "no_show",
};

const BOOKING_STATUS_TO_DINING = {
  inquiry: "Pending",
  confirmed: "confirmed",
  reserved: "assigned",
  checked_in: "seated",
  checked_out: "completed",
  cancelled: "cancelled",
  no_show: "no-show",
};

function parseDiningMeta(specialRequests) {
  if (!specialRequests) return {};
  try {
    const parsed = JSON.parse(specialRequests);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function mapReservationRow(row) {
  if (!row) return null;
  const meta = parseDiningMeta(row.special_requests);
  return {
    id: row.id,
    reservationCode: row.booking_code,
    customerName: row.primary_guest_name || meta.customerName || null,
    mobile: row.primary_guest_phone || meta.mobile || null,
    email: row.primary_guest_email || meta.email || null,
    reservationDate: row.check_in,
    timeSlot: meta.timeSlot || null,
    guestCount: Number(row.total_guests || 1),
    tablePreference: meta.tablePreference || null,
    occasion: meta.occasion || null,
    specialRequest: meta.specialRequest || null,
    status: BOOKING_STATUS_TO_DINING[row.status] || row.status,
    source: meta.source || row.source_name || "website",
    assignedTableId: meta.assignedTableId || null,
    assignedTableNumber: meta.assignedTableNumber || null,
    confirmedBy: meta.confirmedBy || null,
    confirmedAt: meta.confirmedAt || null,
    cancelledAt: row.cancelled_at,
    notes: meta.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateReservationCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DIN-${ts}-${rand}`;
}

// Booking metadata is stored as JSON in `special_requests`; merge new keys in
// rather than replacing, so unrelated booking metadata is preserved.
async function mergeDiningMeta(bookingId, patch) {
  const [rows] = await db.query(
    "SELECT special_requests FROM bookings WHERE id = ? LIMIT 1",
    [bookingId]
  );
  const current = parseDiningMeta(rows?.[0]?.special_requests);
  const merged = { ...current, ...patch };
  await db.query("UPDATE bookings SET special_requests = ? WHERE id = ?", [
    JSON.stringify(merged),
    bookingId,
  ]);
  return merged;
}

const RESERVATION_SELECT = `
  SELECT
    b.id,
    b.booking_code,
    b.status,
    b.check_in,
    b.check_out,
    b.total_guests,
    b.cancelled_at,
    b.special_requests,
    b.created_at,
    b.updated_at,
    bg.first_name AS primary_guest_first,
    bg.last_name AS primary_guest_last,
    CONCAT_WS(' ', bg.first_name, bg.last_name) AS primary_guest_name,
    gp.phone AS primary_guest_phone,
    gp.email AS primary_guest_email,
    bs.name AS source_name
  FROM bookings b
  LEFT JOIN booking_guests bg ON bg.booking_id = b.id AND bg.is_primary = 1
  LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
  LEFT JOIN booking_sources bs ON bs.id = b.source_id
`;

/* ─── Public: Dining Config ───────────────────────────────────────────────── */

async function getDiningConfig(req, res) {
  try {
    // v4 restaurant_tables uses `number` (not `table_number`) and
    // `is_active` (there is no 'removed' status). app_settings uses key/value.
    const [tables] = await db.query(
      `SELECT id, number, floor_name, section_name, seat_count,
              status, status_color
       FROM restaurant_tables
       WHERE is_active = 1
       ORDER BY section_name, number`
    );
    const mapped = tables.map((t) => ({
      id: t.id,
      tableNumber: t.number,
      floorName: t.floor_name,
      sectionName: t.section_name,
      seatCount: Number(t.seat_count || 4),
      status: t.status,
      statusColor: t.status_color,
    }));

    const [settings] = await db.query(
      `SELECT \`key\`, \`value\` FROM app_settings
       WHERE \`key\` IN (
         'dining_open_time','dining_close_time',
         'dining_slot_interval_minutes','dining_max_guest_count',
         'dining_reservation_hold_minutes','dining_reservation_hold_amount'
       )`
    );
    const config = {};
    for (const row of settings) {
      const raw = row.value;
      config[row.key] = raw === null || raw === '' || isNaN(raw) ? raw : Number(raw);
    }

    res.json({ success: true, data: { tables: mapped, config } });
  } catch (err) {
    console.error("getDiningConfig error:", err);
    res.status(500).json({ error: "Failed to load dining config" });
  }
}

/* ─── Public: Availability ────────────────────────────────────────────────── */

async function getDiningAvailability(req, res) {
  try {
    const { reservationDate, guestCount } = req.query;
    const date = reservationDate || new Date().toISOString().slice(0, 10);
    const guests = Math.max(1, Number(guestCount) || 1);

    // Fetch tables with enough seats that are currently 'available'.
    // v4 restaurant_tables uses `number` (not `table_number`) and `is_active`.
    const [tables] = await db.query(
      `SELECT id, number, floor_name, section_name, seat_count,
              status, status_color
       FROM restaurant_tables
       WHERE status = 'available'
         AND is_active = 1
         AND seat_count >= ?
       ORDER BY seat_count ASC, section_name, number`,
      [guests]
    );

    // Occupancy comes from live orders in the v4 schema: any table with an
    // order that is not yet completed/cancelled is considered taken.
    const [activeOrders] = await db.query(
      `SELECT DISTINCT table_number
       FROM orders
       WHERE status NOT IN ('completed','cancelled')
         AND DATE(created_at) = ?`,
      [date]
    );
    const occupiedSet = new Set(
      activeOrders.map((r) => String(r.table_number)).filter(Boolean)
    );

    const availableTables = tables.filter(
      (t) => !occupiedSet.has(String(t.number))
    );

    res.json({
      success: true,
      data: {
        date,
        guestCount: guests,
        tables: availableTables.map((t) => ({
          id: t.id,
          tableNumber: t.number,
          floorName: t.floor_name,
          sectionName: t.section_name,
          seatCount: Number(t.seat_count || 4),
          status: t.status,
          statusColor: t.status_color,
        })),
      },
    });
  } catch (err) {
    console.error("getDiningAvailability error:", err);
    res.status(500).json({ error: "Failed to check availability" });
  }
}

/* ─── Public: Create Reservation ──────────────────────────────────────────── */

async function createReservation(req, res) {
  try {
    const {
      customerName,
      mobile,
      email,
      reservationDate,
      timeSlot,
      guestCount,
      tablePreference,
      occasion,
      specialRequest,
      source,
    } = req.body;

    if (!customerName || !mobile || !reservationDate || !timeSlot) {
      return res
        .status(400)
        .json({ error: "customerName, mobile, reservationDate, and timeSlot are required" });
    }

    const code = generateReservationCode();
    const guests = Math.max(1, Number(guestCount) || 1);
    const meta = {
      timeSlot,
      tablePreference: tablePreference || null,
      occasion: occasion || null,
      specialRequest: specialRequest || null,
      source: source || "website",
      kind: "dining",
    };

    const [result] = await db.query(
      `INSERT INTO bookings
        (booking_code, status, check_in, check_out, total_guests,
         special_requests, created_at, updated_at)
       VALUES (?, 'inquiry', ?, ?, ?, ?, NOW(), NOW())`,
      [code, reservationDate, reservationDate, guests, JSON.stringify(meta)]
    );

    const bookingId = result.insertId;

    // Store the guest on the booking (no dedicated guest profile required for
    // a web reservation). guest_profile_id stays NULL; first_name is required.
    await db.query(
      `INSERT INTO booking_guests
        (booking_id, guest_profile_id, is_primary, first_name, last_name)
       VALUES (?, NULL, 1, ?, NULL)`,
      [bookingId, customerName]
    );

    // Keep contact details retrievable without a guest profile row.
    await mergeDiningMeta(bookingId, { mobile, email: email || null, customerName });

    const [rows] = await db.query(`${RESERVATION_SELECT} WHERE b.id = ? LIMIT 1`, [bookingId]);
    res.status(201).json({ success: true, data: mapReservationRow(rows?.[0] || null) });
  } catch (err) {
    console.error("createReservation error:", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
}

/* ─── Public: Get by Code ─────────────────────────────────────────────────── */

async function getReservationByCode(req, res) {
  try {
    const { code } = req.params;
    const [rows] = await db.query(
      `${RESERVATION_SELECT} WHERE b.booking_code = ? LIMIT 1`,
      [code]
    );
    const row = rows?.[0] || null;
    if (!row) return res.json({ success: true, data: null });
    res.json({ success: true, data: mapReservationRow(row) });
  } catch (err) {
    console.error("getReservationByCode error:", err);
    res.status(500).json({ error: "Failed to fetch reservation" });
  }
}

/* ─── Public: Cancel ──────────────────────────────────────────────────────── */

async function cancelReservation(req, res) {
  try {
    const { code } = req.params;
    const { reason } = req.body || {};

    const [rows] = await db.query(
      "SELECT id, status, special_requests FROM bookings WHERE booking_code = ? LIMIT 1",
      [code]
    );
    const row = rows?.[0];
    if (!row) return res.json({ success: true, message: "Reservation already cancelled" });
    if (row.status === "cancelled")
      return res.status(400).json({ error: "Reservation already cancelled" });

    await db.query(
      `UPDATE bookings
       SET status = 'cancelled',
           cancellation_reason = ?,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [reason || "Cancelled via website", row.id]
    );

    res.json({ success: true, message: "Reservation cancelled" });
  } catch (err) {
    console.error("cancelReservation error:", err);
    res.status(500).json({ error: "Failed to cancel reservation" });
  }
}

/* ─── Admin: List Reservations ────────────────────────────────────────────── */

async function getAdminReservations(req, res) {
  try {
    const {
      status,
      reservationDate,
      page = 1,
      limit = 50,
    } = req.query;

    const where = ["b.id IS NOT NULL"];
    const params = [];

    if (status) {
      const mapped = DINING_STATUS_TO_BOOKING[String(status).toLowerCase()] || status;
      where.push("b.status = ?");
      params.push(mapped);
    }
    if (reservationDate) {
      where.push("b.check_in = ?");
      params.push(reservationDate);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const [countRow] = await db.query(
      `SELECT COUNT(*) AS total FROM bookings b ${whereSql}`,
      params
    );
    const total = Number(countRow?.total || 0);

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await db.query(
      `${RESERVATION_SELECT}
       ${whereSql}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: rows.map(mapReservationRow),
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error("getAdminReservations error:", err);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
}

/* ─── Admin: Confirm ──────────────────────────────────────────────────────── */

async function confirmReservation(req, res) {
  try {
    const { id } = req.params;
    const { confirmedBy } = req.body || {};

    const [rows] = await db.query(
      "SELECT id FROM bookings WHERE id = ? LIMIT 1",
      [id]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: "Reservation not found" });

    await db.query(
      `UPDATE bookings
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );
    await mergeDiningMeta(id, { confirmedBy: confirmedBy || null, confirmedAt: new Date().toISOString() });

    res.json({ success: true, message: "Reservation confirmed" });
  } catch (err) {
    console.error("confirmReservation error:", err);
    res.status(500).json({ error: "Failed to confirm reservation" });
  }
}

/* ─── Admin: Assign Table ─────────────────────────────────────────────────── */

async function assignTable(req, res) {
  try {
    const { id } = req.params;
    const { tableId, tableNumber } = req.body || {};

    if (!tableNumber) {
      return res.status(400).json({ error: "tableNumber is required" });
    }

    const [rows] = await db.query(
      "SELECT id FROM bookings WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Reservation not found" });

    await db.query(
      `UPDATE bookings SET status = 'reserved', updated_at = NOW() WHERE id = ?`,
      [id]
    );
    await mergeDiningMeta(id, {
      assignedTableId: tableId || null,
      assignedTableNumber: tableNumber,
    });

    res.json({ success: true, message: "Table assigned" });
  } catch (err) {
    console.error("assignTable error:", err);
    res.status(500).json({ error: "Failed to assign table" });
  }
}

/* ─── Admin: Seat ─────────────────────────────────────────────────────────── */

async function markSeated(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT id FROM bookings WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Reservation not found" });

    await db.query(
      `UPDATE bookings SET status = 'checked_in', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: "Reservation marked as seated" });
  } catch (err) {
    console.error("markSeated error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
}

/* ─── Admin: No-show ──────────────────────────────────────────────────────── */

async function markNoShow(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT id FROM bookings WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Reservation not found" });

    await db.query(
      `UPDATE bookings SET status = 'no_show', updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: "Reservation marked as no-show" });
  } catch (err) {
    console.error("markNoShow error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
}

module.exports = {
  getDiningConfig,
  getDiningAvailability,
  createReservation,
  getReservationByCode,
  cancelReservation,
  getAdminReservations,
  confirmReservation,
  assignTable,
  markSeated,
  markNoShow,
};
