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

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, res) => (err ? reject(err) : resolve(res)))
  );

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function mapReservationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reservationCode: row.reservation_code,
    customerName: row.customer_name,
    mobile: row.mobile,
    email: row.email,
    reservationDate: row.reservation_date,
    timeSlot: row.time_slot,
    guestCount: Number(row.guest_count || 1),
    tablePreference: row.table_preference,
    occasion: row.occasion,
    specialRequest: row.special_request,
    status: row.status,
    source: row.source,
    assignedTableId: row.assigned_table_id,
    assignedTableNumber: row.assigned_table_number,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    holdExpiresAt: row.hold_expires_at,
    paymentAmount: Number(row.paymentAmount || 0),
    razorpayOrderId: row.razorpayOrderId,
    razorpayPaymentId: row.razorpayPaymentId,
    paidAt: row.paidAt,
  };
}

function generateReservationCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DIN-${ts}-${rand}`;
}

/* ─── Public: Dining Config ───────────────────────────────────────────────── */

async function getDiningConfig(req, res) {
  try {
    const [tables] = await q(
      `SELECT id, table_number, floor_name, section_name, seat_count,
              status, status_color
       FROM restaurant_tables
       WHERE status != 'removed'
       ORDER BY section_name, table_number`
    );
    const mapped = tables.map((t) => ({
      id: t.id,
      tableNumber: t.table_number,
      floorName: t.floor_name,
      sectionName: t.section_name,
      seatCount: Number(t.seat_count || 4),
      status: t.status,
      statusColor: t.status_color,
    }));

    const [settings] = await q(
      `SELECT setting_key, setting_value FROM app_settings
       WHERE setting_key IN (
         'dining_open_time','dining_close_time',
         'dining_slot_interval_minutes','dining_max_guest_count',
         'dining_reservation_hold_minutes','dining_reservation_hold_amount'
       )`
    );
    const config = {};
    for (const row of settings) {
      config[row.setting_key] = isNaN(row.setting_value)
        ? row.setting_value
        : Number(row.setting_value);
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

    // Fetch tables with enough seats that are currently 'available'
    const [tables] = await q(
      `SELECT id, table_number, floor_name, section_name, seat_count,
              status, status_color
       FROM restaurant_tables
       WHERE status = 'available'
         AND seat_count >= ?
       ORDER BY seat_count ASC, section_name, table_number`,
      [guests]
    );

    // For each table check if there's an active reservation that overlaps
    // (simple same-slot check: we match by reservation_date + status NOT cancelled)
    const [activeReservations] = await q(
      `SELECT assigned_table_number, reservation_date, status
       FROM website_table_reservations
       WHERE reservation_date = ?
         AND status NOT IN ('cancelled','no-show','seated','completed')`,
      [date]
    );
    const occupiedSet = new Set(
      activeReservations.map((r) => r.assigned_table_number).filter(Boolean)
    );

    const availableTables = tables.filter(
      (t) => !occupiedSet.has(t.table_number)
    );

    res.json({
      success: true,
      data: {
        date,
        guestCount: guests,
        tables: availableTables.map((t) => ({
          id: t.id,
          tableNumber: t.table_number,
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
  const conn = await q("START TRANSACTION");
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
      await q("ROLLBACK");
      return res
        .status(400)
        .json({ error: "customerName, mobile, reservationDate, and timeSlot are required" });
    }

    const code = generateReservationCode();

    await q(
      `INSERT INTO website_table_reservations
        (reservation_code, customer_name, mobile, email, reservation_date,
         time_slot, guest_count, table_preference, occasion, special_request,
         status, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        code,
        customerName,
        mobile,
        email || null,
        reservationDate,
        timeSlot,
        Math.max(1, Number(guestCount) || 1),
        tablePreference || null,
        occasion || null,
        specialRequest || null,
        "Pending",
        source || "website",
      ]
    );

    const [row] = await q(
      "SELECT * FROM website_table_reservations WHERE reservation_code = ?",
      [code]
    );

    await q("COMMIT");
    res.status(201).json({ success: true, data: mapReservationRow(row) });
  } catch (err) {
    await q("ROLLBACK").catch(() => {});
    console.error("createReservation error:", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
}

/* ─── Public: Get by Code ─────────────────────────────────────────────────── */

async function getReservationByCode(req, res) {
  try {
    const { code } = req.params;
    const [rows] = await q(
      "SELECT * FROM website_table_reservations WHERE reservation_code = ? LIMIT 1",
      [code]
    );
    const row = rows?.[0] || null;
    if (!row) return res.status(404).json({ error: "Reservation not found" });
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

    const [rows] = await q(
      "SELECT * FROM website_table_reservations WHERE reservation_code = ? LIMIT 1",
      [code]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: "Reservation not found" });
    if (row.status === "cancelled")
      return res.status(400).json({ error: "Reservation already cancelled" });

    await q(
      `UPDATE website_table_reservations
       SET status = 'cancelled', notes = ?, cancelled_at = NOW()
       WHERE id = ?`,
      [reason || row.notes || "Cancelled via website", row.id]
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

    const where = [];
    const params = [];

    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    if (reservationDate) {
      where.push("reservation_date = ?");
      params.push(reservationDate);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [countRow] = await q(
      `SELECT COUNT(*) AS total FROM website_table_reservations ${whereSql}`,
      params
    );
    const total = Number(countRow?.total || 0);

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await q(
      `SELECT * FROM website_table_reservations
       ${whereSql}
       ORDER BY created_at DESC
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

    const [rows] = await q(
      "SELECT * FROM website_table_reservations WHERE id = ? LIMIT 1",
      [id]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: "Reservation not found" });

    await q(
      `UPDATE website_table_reservations
       SET status = 'confirmed',
           confirmed_by = ?,
           confirmed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [confirmedBy || null, id]
    );

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

    const [rows] = await q(
      "SELECT * FROM website_table_reservations WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Reservation not found" });

    const updateFields = [];
    const updateParams = [];
    updateFields.push("assigned_table_id = ?");
    updateParams.push(tableId || null);
    updateFields.push("assigned_table_number = ?");
    updateParams.push(tableNumber);
    updateFields.push("status = 'assigned'");
    updateFields.push("updated_at = NOW()");
    updateParams.push(id);

    await q(
      `UPDATE website_table_reservations SET ${updateFields.join(", ")} WHERE id = ?`,
      updateParams
    );

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

    const [rows] = await q(
      "SELECT * FROM website_table_reservations WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Reservation not found" });

    await q(
      `UPDATE website_table_reservations SET status = 'seated', updated_at = NOW()
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

    const [rows] = await q(
      "SELECT * FROM website_table_reservations WHERE id = ? LIMIT 1",
      [id]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "Reservation not found" });

    await q(
      `UPDATE website_table_reservations SET status = 'no-show', updated_at = NOW()
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
