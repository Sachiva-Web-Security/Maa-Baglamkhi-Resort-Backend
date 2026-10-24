// /api/reports-suite — the admin-side accounts + reporting suite.
//
// 19 read-only reports for admin/manager/accountant. Every endpoint takes
// ?from&to (YYYY-MM-DD, default last 30 days) and ?format=csv for a
// Content-Disposition CSV download. No table is written except the night
// audit's snapshot upsert (CREATE TABLE IF NOT EXISTS, additive only).

const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
  dateRange,
  queryOrEmpty,
  tableExists,
  sendReport,
  safeArray,
  round2,
  isoDate,
} = require("../utils/reportsSuiteUtils");

router.use(authMiddleware);
router.use(roleMiddleware(["admin", "manager", "accountant"]));

// ── shared helpers ──────────────────────────────────────────────────────────

// SUM one column where the table exists on this deployment; else 0.
async function sumColumn(table, col, where = "", params = []) {
  if (!(await tableExists(table))) return 0;
  const rows = await queryOrEmpty(
    `SELECT COALESCE(SUM(${col}), 0) AS s FROM ${table}${where ? ` WHERE ${where}` : ""}`,
    params,
  );
  return round2(rows[0] ? Number(rows[0].s || 0) : 0);
}

async function countRows(table, where = "", params = []) {
  if (!(await tableExists(table))) return 0;
  const rows = await queryOrEmpty(
    `SELECT COUNT(*) AS c FROM ${table}${where ? ` WHERE ${where}` : ""}`,
    params,
  );
  return rows[0] ? Number(rows[0].c || 0) : 0;
}

// ── 1. MIS report — money across every department for the period ─────────

router.get("/mis", async (req, res) => {
  const { from, to } = dateRange(req);
  const range = (col) => `${col} >= ? AND ${col} <= ?`;

  const [
    hotelRoomCharges,
    restaurantSales,
    banquetSales,
    cashReceipts,
    cardReceipts,
    upiReceipts,
    otherReceipts,
    expenses,
    payroll,
    refunds,
  ] = await Promise.all([
    sumColumn("bookings", "total_amount", range("check_in"), [from, to]),
    sumColumn("bills", "total", range("DATE(created_at)"), [from, to]),
    sumColumn("banquet_bookings", "total_amount", range("DATE(event_date)"), [from, to]),
    // Receipts split by channel, in whatever method column the deployments
    // actually have (payment_methods join if present, bare column if not).
    sumColumn("payments", "amount", "status = 'completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ?", [from, to]),
    0,
    0,
    0,
    await (async () => {
      const total = await sumColumn("transactions", "1", range("transaction_date"), [from, to]);
      return total;
    })(),
    sumColumn("payroll_records", "gross_pay", range("DATE(pay_date)"), [from, to]),
    sumColumn("payments", "amount", "status = 'completed' AND payment_type = 'refund' AND DATE(created_at) >= ? AND DATE(created_at) <= ?", [from, to]),
  ]);

  // Channel split: cash vs card vs upi vs netbanking vs other
  const [cash, card, upi, netbanking, other] = await (async () => {
    if (!(await tableExists("payments"))) {
      return [cashReceipts, 0, 0, 0, 0];
    }
    const sql = `
      SELECT
        pm.name AS method,
        COALESCE(SUM(p.amount), 0) AS total
      FROM payments p
      LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
      WHERE p.status = 'completed' AND DATE(p.created_at) >= ? AND DATE(p.created_at) <= ?
      GROUP BY pm.name`;
    const rows = await queryOrEmpty(sql, [from, to]);
    const by = {};
    for (const r of safeArray(rows)) by[r.method || "other"] = Number(r.total || 0);
    const c = (keys) => round2(keys.reduce((acc, k) => acc + (by[k] || 0), 0));
    const matched = c(["Cash", "cash", "Card", "card", "UPI", "upi", "NetBanking", "netbanking", "Other", "other", "Wallet", "wallet"]);
    const [a, b, c2, d, e] = [
      round2(c(["Cash", "cash"])),
      round2(c(["Card", "card"])),
      round2(c(["UPI", "upi"])),
      round2(c(["NetBanking", "netbanking"])),
      round2(c(["Wallet", "wallet", "Other", "other"])),
    ];
    void matched;
    return [a, b, c2, d, e];
  })();

  const netIncome = round2(hotelRoomCharges + restaurantSales + banquetSales - expenses - payroll - refunds);
  await sendReport(req, res, {
    reportKey: "mis",
    columns: ["hotel_room_charges", "restaurant_sales", "banquet_sales", "cash", "card", "upi", "netbanking", "other_receipts", "expenses", "payroll", "refunds", "net_income"],
    rows: [
      {
        hotel_room_charges: hotelRoomCharges,
        restaurant_sales: restaurantSales,
        banquet_sales: banquetSales,
        cash,
        card,
        upi,
        netbanking,
        other_receipts: other,
        expenses,
        payroll,
        refunds,
        net_income: netIncome,
      },
    ],
    summary: {
      from,
      to,
      total_income: round2(hotelRoomCharges + restaurantSales + banquetSales),
      net_income: netIncome,
    },
  });
});

// ── 2. Invoice register ─────────────────────────────────────────────────────

router.get("/invoice-register", async (req, res) => {
  const { from, to } = dateRange(req);
  const hasInvoices = await tableExists("invoices");
  const hasBookings = await tableExists("bookings");

  const invoices = hasInvoices
    ? await queryOrEmpty(
        `SELECT
           i.id,
           i.invoice_no,
           i.invoice_no AS invoiceNumber,
           DATE_FORMAT(COALESCE(i.created_at, i.updated_at), '%Y-%m-%d') AS date,
           i.status,
           i.payment_status AS paymentStatus,
           i.payment_mode AS paymentMode,
           i.total_amount AS total,
           i.amount_paid AS paid,
           (i.total_amount - COALESCE(i.amount_paid, 0)) AS balance,
           i.notes
         FROM invoices i
         WHERE DATE(COALESCE(i.created_at, i.updated_at)) >= ? AND DATE(COALESCE(i.created_at, i.updated_at)) <= ?
         ORDER BY i.id DESC`,
        [from, to],
      )
    : [];

  const bookings = hasBookings
    ? await queryOrEmpty(
        `SELECT
           b.id,
           b.booking_code,
           DATE_FORMAT(b.check_in, '%Y-%m-%d') AS date,
           b.status,
           b.total_amount AS total,
           b.balance_amount AS balance,
           (
             SELECT COALESCE(SUM(p.amount), 0) FROM payments p
             WHERE p.booking_id = b.id AND p.status = 'completed'
           ) AS paid
         FROM bookings b
         WHERE b.status <> 'cancelled'
           AND b.check_in >= ? AND b.check_in <= ?
         ORDER BY b.id DESC`,
        [from, to],
      )
    : [];

  const rows = [
    ...invoices.map((r) => ({ source: "invoices", reference: r.invoiceNumber || r.invoice_no, ...r })),
    ...bookings.map((r) => ({ source: "bookings", reference: r.booking_code, ...r })),
  ];
  const columns = ["source", "reference", "date", "status", "paymentStatus", "paymentMode", "total", "paid", "balance", "notes"];
  const total = round2(rows.reduce((a, r) => a + Number(r.total || 0), 0));
  const paid = round2(rows.reduce((a, r) => a + Number(r.paid || 0), 0));
  await sendReport(req, res, {
    reportKey: "invoice-register",
    columns,
    rows,
    summary: { from, to, total, paid, outstanding: round2(total - paid) },
  });
});

// ── 3. Service-wise report ─────────────────────────────────────────────────

router.get("/service-wise", async (req, res) => {
  const { from, to } = dateRange(req);
  const services = [
    ["Hotel Rooms", "bookings", "check_in", "total_amount"],
    ["Restaurant", "bills", "DATE(created_at)", "total"],
    ["Banquet", "banquet_bookings", "DATE(event_date)", "total_amount"],
    ["Room Service", "orders", "DATE(created_at)", "total_amount"],
    ["Banquet Add-ons", "banquet_booking_addons", "DATE(created_at)", "amount"],
  ];
  const rows = await Promise.all(
    services.map(async ([label, table, dateCol, moneyCol]) => {
      const exists = await tableExists(table);
      if (!exists)
        return { service: label, count: 0, total: 0, note: "table not present" };
      const total = await sumColumn(table, moneyCol, `${dateCol} >= ? AND ${dateCol} <= ?`, [from, to]);
      const count = await countRows(table, `${dateCol} >= ? AND ${dateCol} <= ?`, [from, to]);
      return { service: label, count, total, note: "" };
    }),
  );
  await sendReport(req, res, {
    reportKey: "service-wise",
    columns: ["service", "count", "total", "note"],
    rows,
    summary: { from, to, grand_total: round2(rows.reduce((a, r) => a + Number(r.total || 0), 0)) },
  });
});

// ── 4. Room occupancy (per room for the period) ──────────────────────────

router.get("/room-occupancy", async (req, res) => {
  const { from, to } = dateRange(req);
  if (!(await tableExists("rooms"))) {
    return sendReport(req, res, {
      reportKey: "room-occupancy",
      columns: [],
      rows: [],
      summary: { from, to, note: "rooms table not present" },
    });
  }
  const roomRows = await queryOrEmpty(`SELECT id, room_number FROM rooms ORDER BY CAST(room_number AS UNSIGNED), room_number`);
  const occRows = await queryOrEmpty(
    `SELECT
       r.room_number,
       COUNT(*) AS nights,
       COALESCE(SUM(b.total_amount), 0) AS revenue
     FROM booking_rooms br
     JOIN rooms r ON r.id = br.room_id
     JOIN bookings b ON b.id = br.booking_id
     WHERE LOWER(COALESCE(b.status, 'confirmed')) NOT IN ('cancelled', 'checked_out')
       AND b.check_in <= ? AND b.check_out >= ?
     GROUP BY r.room_number`,
    [from, to],
  );
  const occMap = new Map(occRows.map((r) => [String(r.room_number), r]));
  const spanDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
  const rows = roomRows.map((r) => {
    const n = occMap.get(String(r.room_number));
    const nights = n ? Number(n.nights || 0) : 0;
    return {
      room_number: r.room_number,
      nights,
      occupancy_pct: round2(Math.min(100, (nights / spanDays) * 100)),
      revenue: n ? round2(n.revenue) : 0,
    };
  });
  await sendReport(req, res, {
    reportKey: "room-occupancy",
    columns: ["room_number", "nights", "occupancy_pct", "revenue"],
    rows,
    summary: {
      from,
      to,
      occupied_rooms: rows.filter((r) => r.nights > 0).length,
      total_rooms: rows.length,
      avg_occupancy_pct: rows.length ? round2(rows.reduce((a, r) => a + r.occupancy_pct, 0) / rows.length) : 0,
    },
  });
});

// ── 5. All-rooms summary (live status) ────────────────────────────────────

router.get("/rooms-all", async (req, res) => {
  const { from, to } = dateRange(req);
  if (!(await tableExists("rooms"))) {
    return sendReport(req, res, {
      reportKey: "rooms-all",
      columns: [],
      rows: [],
      summary: { note: "rooms table not present" },
    });
  }
  const rooms = await queryOrEmpty(
    `SELECT r.id, r.room_number, r.status, c.name AS category
     FROM rooms r LEFT JOIN room_categories c ON c.id = r.category_id
     ORDER BY CAST(r.room_number AS UNSIGNED), r.room_number`,
  );
  const today = isoDate(new Date());
  const inHouse = await queryOrEmpty(
    `SELECT br.room_number AS rn, b.status AS bstatus
     FROM booking_rooms br JOIN bookings b ON b.id = br.booking_id
     WHERE LOWER(COALESCE(b.status,'confirmed')) NOT IN ('checked_out','cancelled')
       AND b.check_in <= ? AND b.check_out >= ?`,
    [today, today],
  );
  const inHouseRooms = new Set(inHouse.map((r) => String(r.rn)));
  const rows = rooms.map((r) => ({
    room_number: r.room_number,
    category: r.category || "",
    status: r.status,
    in_house: inHouseRooms.has(String(r.room_number)) ? "yes" : "no",
  }));
  const byStatus = {};
  rows.forEach((r) => (byStatus[r.status || "unknown"] = (byStatus[r.status || "unknown"] || 0) + 1));
  await sendReport(req, res, {
    reportKey: "rooms-all",
    columns: ["room_number", "category", "status", "in_house"],
    rows,
    summary: { date: today, by_status: JSON.stringify(byStatus) },
  });
});

// ── 6. Check-in room summary ──────────────────────────────────────────────

router.get("/rooms-checkin", async (req, res) => {
  const { from, to } = dateRange(req);
  const has = await tableExists("bookings");
  const rows = has
    ? await queryOrEmpty(
        `SELECT
           DATE_FORMAT(b.check_in, '%Y-%m-%d') AS checkin_date,
           b.booking_code,
           b.status,
           b.total_guests AS guests,
           b.total_amount,
           b.advance_amount,
           (SELECT GROUP_CONCAT(r.room_number SEPARATOR ', ') FROM booking_rooms br JOIN rooms r ON r.id = br.room_id WHERE br.booking_id = b.id) AS rooms
         FROM bookings b
         WHERE b.check_in >= ? AND b.check_in <= ?
         ORDER BY b.check_in DESC, b.id DESC`,
        [from, to],
      )
    : [];
  await sendReport(req, res, {
    reportKey: "rooms-checkin",
    columns: ["checkin_date", "booking_code", "status", "guests", "total_amount", "advance_amount", "rooms"],
    rows,
    summary: { from, to, count: rows.length, total_amount: round2(rows.reduce((a, r) => a + Number(r.total_amount || 0), 0)) },
  });
});

// ── 7. Check-out room summary ─────────────────────────────────────────────

router.get("/rooms-checkout", async (req, res) => {
  const { from, to } = dateRange(req);
  const has = await tableExists("bookings");
  const rows = has
    ? await queryOrEmpty(
        `SELECT
           DATE_FORMAT(b.check_out, '%Y-%m-%d') AS checkout_date,
           b.booking_code,
           b.status,
           b.total_amount,
           (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.booking_id = b.id AND p.status='completed') AS paid,
           b.balance_amount AS balance,
           (SELECT GROUP_CONCAT(r.room_number SEPARATOR ', ') FROM booking_rooms br JOIN rooms r ON r.id = br.room_id WHERE br.booking_id = b.id) AS rooms
         FROM bookings b
         WHERE b.check_out >= ? AND b.check_out <= ?
         ORDER BY b.check_out DESC, b.id DESC`,
        [from, to],
      )
    : [];
  await sendReport(req, res, {
    reportKey: "rooms-checkout",
    columns: ["checkout_date", "booking_code", "status", "total_amount", "paid", "balance", "rooms"],
    rows,
    summary: { from, to, count: rows.length, outstanding: round2(rows.reduce((a, r) => a + Number(r.balance || 0), 0)) },
  });
});

// ── 8. Company ledger (accounting view of transactions + entries) ────────

router.get("/company-ledger", async (req, res) => {
  const { from, to } = dateRange(req);
  const has = await tableExists("transactions");
  const rows = has
    ? await queryOrEmpty(
        `SELECT
           t.transaction_no,
           DATE_FORMAT(t.transaction_date, '%Y-%m-%d') AS date,
           t.description,
           t.reference_type,
           t.reference_id,
           e.account_id,
           e.entry_type,
           e.amount
         FROM transactions t
         LEFT JOIN transaction_entries e ON e.transaction_id = t.id
         WHERE t.transaction_date >= ? AND t.transaction_date <= ?
         ORDER BY t.transaction_date DESC, t.id DESC, e.id DESC`,
        [from, to],
      )
    : [];
  let debit = 0;
  let credit = 0;
  for (const r of rows) {
    const amt = Number(r.amount || 0);
    if (r.entry_type === "debit") debit = round2(debit + amt);
    else credit = round2(credit + amt);
  }
  await sendReport(req, res, {
    reportKey: "company-ledger",
    columns: ["transaction_no", "date", "description", "reference_type", "reference_id", "account_id", "entry_type", "amount"],
    rows,
    summary: { from, to, debit, credit, net: round2(debit - credit) },
  });
});

// ── 9. Room history (every booking that touched a room, in the period) ───

router.get("/room-history", async (req, res) => {
  const { from, to } = dateRange(req);
  const has = await tableExists("bookings");
  const rows = has
    ? await queryOrEmpty(
        `SELECT
           DATE_FORMAT(b.check_in, '%Y-%m-%d') AS checkin,
           DATE_FORMAT(b.check_out, '%Y-%m-%d') AS checkout,
           b.booking_code,
           b.status,
           r.room_number,
           (
             SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(gp.first_name,''), ' ', COALESCE(gp.last_name,''))),''), br.guest_name, '—')
             FROM booking_guests bg LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
             WHERE bg.booking_id = b.id ORDER BY bg.id LIMIT 1
           ) AS guest
         FROM booking_rooms br
         JOIN rooms r ON r.id = br.room_id
         JOIN bookings b ON b.id = br.booking_id
         WHERE b.check_in >= ? OR b.check_out <= ?
         ORDER BY b.check_in DESC, b.id DESC, r.room_number`,
        [to, from],
      )
    : [];
  await sendReport(req, res, {
    reportKey: "room-history",
    columns: ["checkin", "checkout", "booking_code", "status", "room_number", "guest"],
    rows,
    summary: { from, to, count: rows.length },
  });
});

// ── 10. Room performance (revenue per room, per night rate) ──────────────

router.get("/room-performance", async (req, res) => {
  const { from, to } = dateRange(req);
  const has = await tableExists("bookings");
  const rows = has
    ? await queryOrEmpty(
        `SELECT
           r.room_number,
           COUNT(DISTINCT b.id) AS stays,
           COALESCE(SUM(b.total_amount),0) AS revenue,
           GREATEST(1, MAX(TIMESTAMPDIFF(DAY, b.check_in, b.check_out))) AS longest_nights,
           CASE WHEN MAX(TIMESTAMPDIFF(DAY, b.check_in, b.check_out)) > 0
                THEN ROUND(SUM(b.total_amount) / GREATEST(1, MAX(TIMESTAMPDIFF(DAY, b.check_in, b.check_out))), 2)
                ELSE 0 END AS avg_rate_per_night
         FROM booking_rooms br
         JOIN rooms r ON r.id = br.room_id
         JOIN bookings b ON b.id = br.booking_id
         WHERE b.status <> 'cancelled' AND b.check_in >= ? AND b.check_in <= ?
         GROUP BY r.room_number
         ORDER BY revenue DESC`,
        [from, to],
      )
    : [];
  await sendReport(req, res, {
    reportKey: "room-performance",
    columns: ["room_number", "stays", "revenue", "longest_nights", "avg_rate_per_night"],
    rows,
    summary: {
      from,
      to,
      total_revenue: round2(rows.reduce((a, r) => a + Number(r.revenue || 0), 0)),
      top_room: rows[0] ? rows[0].room_number : null,
    },
  });
});

// ── 11. Guest list (for police) — in-house + checked out in the period ────

router.get("/guest-list-police", async (req, res) => {
  const { from, to } = dateRange(req);
  const hasBookings = await tableExists("bookings");
  const hasGuestDocs = await tableExists("guest_documents");
  const today = isoDate(new Date());
  const inHouse = hasBookings
    ? await queryOrEmpty(
        `SELECT
           b.id, b.booking_code, r.room_number, b.check_in AS checkin_date, b.check_out AS checkout_date,
           b.status,
           (
             SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(gp.first_name,''),' ',COALESCE(gp.last_name,''))),''), bg.guest_name)
             FROM booking_guests bg LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
             WHERE bg.booking_id = b.id ORDER BY bg.id LIMIT 1
           ) AS guest_name,
           (
             SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(gp.first_name,''),' ',COALESCE(gp.last_name,''))),''), bg.guest_name)
             FROM booking_guests bg LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
             WHERE bg.booking_id = b.id AND bg.is_primary = 1 ORDER BY bg.id LIMIT 1
           ) AS primary_guest,
           b.total_guests,
           b.currency,
           b.adults, b.children, b.infants
         FROM booking_rooms br
         JOIN rooms r ON r.id = br.room_id
         JOIN bookings b ON b.id = br.booking_id
         WHERE LOWER(COALESCE(b.status,'confirmed')) NOT IN ('cancelled','checked_out')
           AND b.check_in <= ? AND b.check_out >= ?
         ORDER BY r.room_number`,
        [today, today],
      )
    : [];
  const checkedOut = hasBookings
    ? await queryOrEmpty(
        `SELECT
           b.id, b.booking_code, r.room_number, b.check_in AS checkin_date, b.check_out AS checkout_date,
           b.status,
           (
             SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(gp.first_name,''),' ',COALESCE(gp.last_name,''))),''), bg.guest_name)
             FROM booking_guests bg LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
             WHERE bg.booking_id = b.id ORDER BY bg.id LIMIT 1
           ) AS guest_name,
           b.total_guests, b.currency
         FROM booking_rooms br
         JOIN rooms r ON r.id = br.room_id
         JOIN bookings b ON b.id = br.booking_id
         WHERE b.status = 'checked_out' AND b.check_out >= ? AND b.check_out <= ?
         ORDER BY b.check_out DESC`,
        [from, to],
      )
    : [];
  const rows = [
    ...inHouse.map((r) => ({ section: "IN-HOUSE", ...r, document_number: "", document_type: "" })),
    ...checkedOut.map((r) => ({ section: "CHECKED-OUT", ...r, document_number: "", document_type: "" })),
  ];
  // Attach guest documents (ID proof) per booking when the table exists.
  if (hasGuestDocs && rows.length) {
    const bookingIds = rows.map((r) => r.id);
    const placeholders = bookingIds.map(() => "?").join(",");
    const docs = await queryOrEmpty(
      `SELECT booking_id, document_type, document_number FROM guest_documents WHERE booking_id IN (${placeholders}) ORDER BY booking_id`,
      bookingIds,
    );
    const docMap = new Map();
    for (const d of safeArray(docs)) {
      if (!docMap.has(d.booking_id)) docMap.set(d.booking_id, []);
      docMap.get(d.booking_id).push(`${d.document_type || "doc"} ${d.document_number || ""}`.trim());
    }
    for (const r of rows) {
      const docs = docMap.get(r.id);
      r.document_number = docs ? docs.join("; ") : "";
      r.document_type = docs ? "ID proof on file" : "";
    }
  }
  await sendReport(req, res, {
    reportKey: "guest-list-police",
    columns: ["section", "booking_code", "room_number", "guest_name", "primary_guest", "total_guests", "checkin_date", "checkout_date", "status", "currency", "document_number", "document_type"],
    rows,
    summary: {
      date: today,
      in_house: inHouse.length,
      checked_out_in_range: checkedOut.length,
      from,
      to,
    },
  });
});

// ── 12. Housekeeping history ───────────────────────────────────────────────

router.get("/housekeeping-history", async (req, res) => {
  const { from, to } = dateRange(req);
  const hasLogs = await tableExists("housekeeping_logs");
  const hasCleanings = await tableExists("completed_cleaning_logs");
  const logRows = hasLogs
    ? await queryOrEmpty(
        `SELECT room_number, status, assigned_to AS assignee, DATE_FORMAT(completed_at, '%Y-%m-%d %H:%i') AS completed_at
         FROM housekeeping_logs
         WHERE DATE(COALESCE(completed_at, created_at)) >= ? AND DATE(COALESCE(completed_at, created_at)) <= ?
         ORDER BY completed_at DESC`,
        [from, to],
      )
    : [];
  const cleanRows = hasCleanings
    ? await queryOrEmpty(
        `SELECT room_number, cleaned_by AS assignee, DATE_FORMAT(cleaned_at, '%Y-%m-%d %H:%i') AS completed_at, notes
         FROM completed_cleaning_logs
         WHERE DATE(cleaned_at) >= ? AND DATE(cleaned_at) <= ?
         ORDER BY cleaned_at DESC`,
        [from, to],
      )
    : [];
  const rows = [
    ...logRows.map((r) => ({ source: "housekeeping_logs", ...r, notes: "" })),
    ...cleanRows.map((r) => ({ source: "completed_cleaning_logs", room_number: r.room_number, status: "cleaned", assignee: r.assignee, completed_at: r.completed_at, notes: r.notes || "" })),
  ];
  await sendReport(req, res, {
    reportKey: "housekeeping-history",
    columns: ["source", "room_number", "status", "assignee", "completed_at", "notes"],
    rows,
    summary: { from, to, count: rows.length },
  });
});

// ── 13. Maintenance history ───────────────────────────────────────────────

router.get("/maintenance-history", async (req, res) => {
  const { from, to } = dateRange(req);
  const has = await tableExists("maintenance_requests");
  const rows = has
    ? await queryOrEmpty(
        `SELECT
           mr.room_number,
           mr.request_type,
           mr.priority,
           mr.status,
           mr.description,
           DATE_FORMAT(mr.created_at, '%Y-%m-%d %H:%i') AS opened,
           DATE_FORMAT(mr.resolved_at, '%Y-%m-%d %H:%i') AS resolved_at,
           mr.cost
         FROM maintenance_requests mr
         WHERE (mr.created_at >= ? AND mr.created_at <= ?) OR (mr.resolved_at IS NOT NULL AND DATE(mr.resolved_at) >= ? AND DATE(mr.resolved_at) <= ?)
         ORDER BY mr.created_at DESC`,
        [from, to, from, to],
      )
    : [];
  const costTotal = round2(rows.reduce((a, r) => a + Number(r.cost || 0), 0));
  await sendReport(req, res, {
    reportKey: "maintenance-history",
    columns: ["room_number", "request_type", "priority", "status", "description", "opened", "resolved_at", "cost"],
    rows,
    summary: { from, to, count: rows.length, cost_total: costTotal, open: rows.filter((r) => ["open", "in_progress"].includes(r.status)).length },
  });
});

// ── 14. General ledger (chart of accounts with period activity) ──────────

router.get("/general-ledger", async (req, res) => {
  const { from, to } = dateRange(req);
  const hasAccounts = await tableExists("chart_of_accounts");
  const hasEntries = await tableExists("transaction_entries");
  const accounts = hasAccounts
    ? await queryOrEmpty(`SELECT id, code, name, type FROM chart_of_accounts ORDER BY code, name`)
    : [];
  const activity = hasEntries
    ? await queryOrEmpty(
        `SELECT e.account_id, e.entry_type, COALESCE(SUM(e.amount),0) AS total
         FROM transaction_entries e
         JOIN transactions t ON t.id = e.transaction_id
         WHERE t.transaction_date >= ? AND t.transaction_date <= ?
         GROUP BY e.account_id, e.entry_type`,
        [from, to],
      )
    : [];
  const byAccount = new Map();
  for (const a of activity) {
    if (!byAccount.has(a.account_id)) byAccount.set(a.account_id, { debit: 0, credit: 0 });
    const bucket = byAccount.get(a.account_id);
    bucket[a.entry_type === "debit" ? "debit" : "credit"] = round2(bucket[a.entry_type === "debit" ? "debit" : "credit"] + Number(a.total || 0));
  }
  const rows = accounts.map((acc) => {
    const b = byAccount.get(acc.id) || { debit: 0, credit: 0 };
    return {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit: b.debit,
      credit: b.credit,
      balance: round2(b.debit - b.credit),
    };
  });
  await sendReport(req, res, {
    reportKey: "general-ledger",
    columns: ["code", "name", "type", "debit", "credit", "balance"],
    rows,
    summary: {
      from,
      to,
      total_debit: round2(rows.reduce((a, r) => a + r.debit, 0)),
      total_credit: round2(rows.reduce((a, r) => a + r.credit, 0)),
    },
  });
});

// ── 15. Cashbook summary (payments split by channel, day by day) ─────────

router.get("/cashbook-summary", async (req, res) => {
  const { from, to } = dateRange(req);
  const has = await tableExists("payments");
  const rows = has
    ? await queryOrEmpty(
        `SELECT
           DATE_FORMAT(p.created_at, '%Y-%m-%d') AS date,
           COALESCE(pm.name, p.payment_type, 'unknown') AS channel,
           p.payment_type,
           p.status,
           COALESCE(SUM(p.amount), 0) AS amount,
           COUNT(*) AS count
         FROM payments p
         LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
         WHERE DATE(p.created_at) >= ? AND DATE(p.created_at) <= ?
         GROUP BY DATE_FORMAT(p.created_at, '%Y-%m-%d'), COALESCE(pm.name, p.payment_type, 'unknown'), p.payment_type, p.status
         ORDER BY date DESC`,
        [from, to],
      )
    : [];
  await sendReport(req, res, {
    reportKey: "cashbook-summary",
    columns: ["date", "channel", "payment_type", "status", "amount", "count"],
    rows,
    summary: { from, to, total: round2(rows.reduce((a, r) => a + Number(r.amount || 0), 0)) },
  });
});

// ── 16. Night audit (closing snapshot, upserted into a new table) ────────

const ensureNightAuditSnapshotTable = async () => {
  await queryOrEmpty(
    `CREATE TABLE IF NOT EXISTS night_audit_snapshots (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
       audit_date DATE NOT NULL,
       hotel_total DECIMAL(12,2) NOT NULL DEFAULT 0,
       restaurant_total DECIMAL(12,2) NOT NULL DEFAULT 0,
       banquet_total DECIMAL(12,2) NOT NULL DEFAULT 0,
       cash_total DECIMAL(12,2) NOT NULL DEFAULT 0,
       card_total DECIMAL(12,2) NOT NULL DEFAULT 0,
       upi_total DECIMAL(12,2) NOT NULL DEFAULT 0,
       other_total DECIMAL(12,2) NOT NULL DEFAULT 0,
       rooms_occupied INT NOT NULL DEFAULT 0,
       rooms_available INT NOT NULL DEFAULT 0,
       rooms_cleaning INT NOT NULL DEFAULT 0,
       rooms_out_of_service INT NOT NULL DEFAULT 0,
       open_bookings INT NOT NULL DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       PRIMARY KEY (id),
       KEY idx_audit_date (audit_date)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
};

router.get("/night-audit", async (req, res) => {
  const { to: auditDate } = dateRange(req);
  await ensureNightAuditSnapshotTable();

  const [hotel, restaurant, banquet] = await Promise.all([
    sumColumn("bookings", "total_amount", "DATE(check_in) = ?", [auditDate]),
    sumColumn("bills", "total", "DATE(created_at) = ?", [auditDate]),
    sumColumn("banquet_bookings", "total_amount", "DATE(event_date) = ?", [auditDate]),
  ]);

  let cash = 0, card = 0, upi = 0, other = 0;
  if (await tableExists("payments")) {
    const methodRows = await queryOrEmpty(
      `SELECT pm.name AS method, COALESCE(SUM(p.amount), 0) AS total
       FROM payments p LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
       WHERE p.status = 'completed' AND DATE(p.created_at) = ?
       GROUP BY pm.name`,
      [auditDate],
    );
    for (const r of safeArray(methodRows)) {
      const key = (r.method || "other").toLowerCase();
      const amt = Number(r.total || 0);
      if (key.includes("cash")) cash = round2(cash + amt);
      else if (key.includes("card")) card = round2(card + amt);
      else if (key.includes("upi")) upi = round2(upi + amt);
      else other = round2(other + amt);
    }
  }

  const roomStatus = { occupied: 0, available: 0, cleaning: 0, out_of_service: 0 };
  if (await tableExists("rooms")) {
    const rRows = await queryOrEmpty(
      `SELECT LOWER(COALESCE(status, 'available')) AS s, COUNT(*) AS c
       FROM rooms GROUP BY LOWER(COALESCE(status, 'available'))`,
    );
    for (const r of safeArray(rRows)) {
      const k = r.s || "available";
      if (roomStatus[k] !== undefined) roomStatus[k] = Number(r.c || 0);
      else roomStatus.available = roomStatus.available + Number(r.c || 0);
    }
  }
  const openBookings = await countRows(
    "bookings",
    "LOWER(COALESCE(status, 'confirmed')) IN ('confirmed', 'reserved', 'checked_in') AND check_out >= ?",
    [auditDate],
  );

  // Upsert the snapshot row (additive: only this new table is written).
  // This server rejects ON DUPLICATE KEY UPDATE, so upsert as delete + insert
  // on a second connection-free path: delete first, then insert.
  await queryOrEmpty(
    `DELETE FROM night_audit_snapshots WHERE audit_date = ?`,
    [auditDate],
  );
  await queryOrEmpty(
    `INSERT INTO night_audit_snapshots
       (audit_date, hotel_total, restaurant_total, banquet_total,
        cash_total, card_total, upi_total, other_total,
        rooms_occupied, rooms_available, rooms_cleaning, rooms_out_of_service, open_bookings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      auditDate, hotel, restaurant, banquet,
      cash, card, upi, other,
      roomStatus.occupied, roomStatus.available, roomStatus.cleaning, roomStatus.out_of_service,
      openBookings,
    ],
  );

  const row = {
    date: auditDate,
    hotel_total: hotel,
    restaurant_total: restaurant,
    banquet_total: banquet,
    total_receipts: round2(hotel + restaurant + banquet),
    cash, card, upi, other,
    total_payments: round2(cash + card + upi + other),
    rooms_occupied: roomStatus.occupied,
    rooms_available: roomStatus.available,
    rooms_cleaning: roomStatus.cleaning,
    rooms_out_of_service: roomStatus.out_of_service,
    open_bookings: openBookings,
  };
  await sendReport(req, res, {
    reportKey: "night-audit",
    columns: [
      "date", "hotel_total", "restaurant_total", "banquet_total", "total_receipts",
      "cash", "card", "upi", "other", "total_payments",
      "rooms_occupied", "rooms_available", "rooms_cleaning", "rooms_out_of_service", "open_bookings",
    ],
    rows: [row],
    summary: { date: auditDate, total_receipts: row.total_receipts },
  });
});

// ── 17. Cash summary (petty cash + cash receipts) ─────────────────────────

router.get("/cash-summary", async (req, res) => {
  const { from, to } = dateRange(req);
  const hasPetty = await tableExists("petty_cash_entries");
  const petty = hasPetty
    ? await queryOrEmpty(
        `SELECT id, date, description, amount, type FROM petty_cash_entries
         WHERE DATE(COALESCE(date, created_at)) >= ? AND DATE(COALESCE(date, created_at)) <= ?
         ORDER BY date DESC`,
        [from, to],
      )
    : [];
  const hasPayments = await tableExists("payments");
  const cashReceipts = hasPayments
    ? await queryOrEmpty(
        `SELECT DATE_FORMAT(p.created_at, '%Y-%m-%d') AS date, p.amount, pm.name AS method, p.payment_type
         FROM payments p
         LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
         WHERE LOWER(COALESCE(pm.name, p.payment_method, '')) = 'cash'
           AND p.status = 'completed'
           AND DATE(p.created_at) >= ? AND DATE(p.created_at) <= ?
         ORDER BY p.created_at DESC`,
        [from, to],
      )
    : [];
  const pettyIn = round2(petty.filter((r) => (r.type || "").toLowerCase().includes("in") || (r.type || "").toLowerCase() === "credit").reduce((a, r) => a + Number(r.amount || 0), 0));
  const pettyOut = round2(petty.filter((r) => !(r.type || "").toLowerCase().includes("in") && (r.type || "").toLowerCase() !== "credit").reduce((a, r) => a + Number(r.amount || 0), 0));
  const cashIn = round2(cashReceipts.filter((r) => (r.payment_type || "").toLowerCase() !== "refund").reduce((a, r) => a + Number(r.amount || 0), 0));
  const cashOut = round2(cashReceipts.filter((r) => (r.payment_type || "").toLowerCase() === "refund").reduce((a, r) => a + Number(r.amount || 0), 0));
  const rows = [
    ...petty.map((r) => ({ source: "petty_cash", date: r.date, description: r.description, type: r.type, amount: Number(r.amount || 0) })),
    ...cashReceipts.map((r) => ({ source: "payments", date: r.date, description: `cash ${r.payment_type}`, type: r.payment_type, amount: Number(r.amount || 0) })),
  ];
  await sendReport(req, res, {
    reportKey: "cash-summary",
    columns: ["source", "date", "description", "type", "amount"],
    rows,
    summary: { from, to, petty_in: pettyIn, petty_out: pettyOut, cash_in: cashIn, cash_out: cashOut, net_cash: round2(cashIn - cashOut) },
  });
});

// ── 18. Refund collection (refund payments + cancelled booking balances) ─

router.get("/refund-collection", async (req, res) => {
  const { from, to } = dateRange(req);
  const hasPayments = await tableExists("payments");
  const hasBookings = await tableExists("bookings");
  const refundPayments = hasPayments
    ? await queryOrEmpty(
        `SELECT p.id, p.booking_id, p.reference_no, p.status, p.payment_type,
           DATE_FORMAT(p.created_at, '%Y-%m-%d') AS date, p.amount, p.transaction_details
         FROM payments p
         WHERE (p.payment_type = 'refund' OR p.status = 'refunded')
           AND DATE(p.created_at) >= ? AND DATE(p.created_at) <= ?
         ORDER BY p.created_at DESC`,
        [from, to],
      )
    : [];
  const cancelledBalances = hasBookings
    ? await queryOrEmpty(
        `SELECT b.id, b.booking_code, b.status, b.total_amount, b.advance_amount, b.balance_amount,
           b.cancellation_reason, DATE_FORMAT(COALESCE(b.cancelled_at, b.updated_at), '%Y-%m-%d') AS cancelled_date
         FROM bookings b
         WHERE b.status = 'cancelled'
           AND DATE(COALESCE(b.cancelled_at, b.updated_at, b.created_at)) >= ?
           AND DATE(COALESCE(b.cancelled_at, b.updated_at, b.created_at)) <= ?
         ORDER BY b.id DESC`,
        [from, to],
      )
    : [];
  const rows = [
    ...refundPayments.map((r) => ({ source: "refund_payment", ...r })),
    ...cancelledBalances.map((r) => ({ source: "cancelled_booking", ...r })),
  ];
  await sendReport(req, res, {
    reportKey: "refund-collection",
    columns: ["source", "id", "booking_id", "reference_no", "status", "payment_type", "date", "amount", "transaction_details", "booking_code", "total_amount", "advance_amount", "balance_amount", "cancellation_reason", "cancelled_date"],
    rows,
    summary: {
      from,
      to,
      refunded: round2(refundPayments.reduce((a, r) => a + Number(r.amount || 0), 0)),
      cancelled_bookings: cancelledBalances.length,
    },
  });
});

// ── 19. Current stock summary (live quantities on hand) ──────────────────

router.get("/stock-summary", async (req, res) => {
  const hasInventory = await tableExists("inventory");
  const rows = hasInventory
    ? await queryOrEmpty(
        `SELECT id, name, category, subcategory, stock, unit, price,
           reorder_point AS reorderPoint,
           CASE WHEN stock <= reorder_point THEN 1 ELSE 0 END AS isLowStock,
           ROUND(stock * price, 2) AS value
         FROM inventory
         ORDER BY isLowStock DESC, name`,
      )
    : [];
  const lowCount = rows.filter((r) => Number(r.isLowStock) === 1).length;
  await sendReport(req, res, {
    reportKey: "stock-summary",
    columns: ["id", "name", "category", "subcategory", "stock", "unit", "price", "reorderPoint", "isLowStock", "value"],
    rows,
    summary: { items: rows.length, low_stock: lowCount, total_value: round2(rows.reduce((a, r) => a + Number(r.value || 0), 0)) },
  });
});

module.exports = router;
