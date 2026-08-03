const db = require("../config/db");

const GuestModel = require("../models/guestModel");
const OtherBookingModel = require("../models/otherBookingModel");
const CompanyModel = require("../models/companyModel");
const PaxModel = require("../models/paxModel");
const AdvanceModel = require("../models/advanceModel");
const ReferenceModel = require("../models/referenceModel");
const RoomTariffModel = require("../models/roomTariffModel");
const Paymentadvance = require("../models/Paymentadvance");
const InvoiceModel = require("../models/InvoiceModel");
const roomInventoryModel = require("../models/hotelRoomInventoryModel");

// WhatsApp helpers — wrapped in try/catch so failures never break the booking flow.
let WhatsAppService;
let InvoicePdfService;
let UserModel;
try {
  WhatsAppService = require("../services/whatsappService");
} catch (e) {
  WhatsAppService = null;
}
try {
  InvoicePdfService = require("../services/invoicePdfService");
} catch (e) {
  InvoicePdfService = null;
}

const fireWhatsAppInvoice = async (bookingId) => {
  if (!WhatsAppService || !InvoicePdfService) return;
  try {
    const invoice = await InvoiceModel.generateCustomerInvoice(Number(bookingId));
    if (!invoice) return;
    const pdf = await InvoicePdfService.generateInvoicePdf(invoice);
    const publicBase =
      (process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || `http://localhost:${process.env.PORT || 5002}`).replace(/\/+$/, "");
    const fileUrl = `${publicBase}/uploads/invoices/${pdf.fileName}`;
    const filePath = pdf.filePath;
    const guestName = invoice.customerName || "Valued Guest";
    const message = `Dear ${guestName},\n\nThank you for staying at Maa Baglamukhi Resort.\n\nYour invoice ${invoice.invoiceNo || ""} is attached.\nTotal: ₹${invoice.totalAmount?.toFixed(2) || "0.00"}\n\nRegards,\nMaa Baglamukhi Resort`;
    const customer = WhatsAppService.normalizePhoneNumber(invoice.phone);
    if (customer) {
      await WhatsAppService.sendWhatsAppMessage({
        number: customer,
        message,
        fileUrl,
        filePath,
        fileName: pdf.fileName,
      });
    }
    // Resolve admin phone from register table (not from env/ADMIN_WHATSAPP_NUMBER)
    let adminNumber = "";
    try {
      if (!UserModel) UserModel = require("../models/UserModel");
      const adminRows = await new Promise((resolve, reject) => {
        UserModel.findAdminUser((err, rows) => (err ? reject(err) : resolve(rows)));
      });
      adminNumber = adminRows?.[0]?.phone || "";
    } catch (e) {
      // ignore — admin will be skipped
    }
    if (adminNumber) {
      const adminMsg = `Invoice sent to ${guestName} for booking ${invoice.invoiceNo || bookingId}. Total: ₹${invoice.totalAmount?.toFixed(2) || "0.00"}`;
      await WhatsAppService.sendWhatsAppMessage({
        number: adminNumber,
        message: adminMsg,
        fileUrl,
        filePath,
        fileName: pdf.fileName,
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error("[WhatsApp] auto-send failed for booking", bookingId, err.message);
    }
  }
};

const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });

const getBookingSummaryById = async (id) => {
  const rows = await query(
    `
      SELECT
        g.id AS bookingId,
        g.booking_code AS bookingCode,
        g.guest_name,
        g.mobile,
        g.guest_email,
        g.check_in,
        g.check_out,
        g.booking_status,
        c.company_name,
        GROUP_CONCAT(rt.room_number ORDER BY rt.room_number) AS rooms
      FROM guests g
      LEFT JOIN companies c ON g.id = c.booking_id
      LEFT JOIN room_tariff rt ON g.id = rt.booking_id
      WHERE g.id = ?
      GROUP BY
        g.id,
        g.booking_code,
        g.guest_name,
        g.mobile,
        g.guest_email,
        g.check_in,
        g.check_out,
        g.booking_status,
        c.company_name
      LIMIT 1
    `,
    [id],
  );

  return rows[0] || null;
};

const ensureBookingWizardSchema = async () => {
  await Promise.all([
    GuestModel.ensureSchema?.(),
    OtherBookingModel.ensureSchema?.(),
    ReferenceModel.ensureSchema?.(),
    CompanyModel.ensureSchema?.(),
    PaxModel.ensureSchema?.(),
    RoomTariffModel.ensureSchema?.(),
    AdvanceModel.ensureSchema?.(),
  ]);
};

const getBookingWizardDataById = async (id) => {
  await ensureBookingWizardSchema();

  const [
    guestRows,
    otherBookingRows,
    referenceRows,
    companyRows,
    paxRows,
    tariffRows,
    advanceRows,
  ] = await Promise.all([
    query(
      `
        SELECT
          g.*,
          DATE_FORMAT(g.check_in, '%Y-%m-%d') AS check_in,
          DATE_FORMAT(g.check_out, '%Y-%m-%d') AS check_out
        FROM guests g
        WHERE g.id = ?
        LIMIT 1
      `,
      [id],
    ),
    query("SELECT * FROM other_booking WHERE guest_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1", [id]),
    query("SELECT * FROM reference_notes WHERE guest_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1", [id]),
    query("SELECT * FROM companies WHERE booking_id = ? ORDER BY id DESC LIMIT 1", [id]),
    query("SELECT * FROM pax WHERE booking_id = ? ORDER BY id DESC", [id]),
    query(
      `
        SELECT
          rt.*,
          hri.category_id AS roomTypeId,
          hrc.name AS roomTypeName,
          hrc.unit_label AS unitLabel
        FROM room_tariff rt
        LEFT JOIN hotel_room_inventory hri
          ON CAST(hri.room_number AS CHAR) = CAST(rt.room_number AS CHAR)
        LEFT JOIN hotel_room_categories hrc
          ON hrc.id = hri.category_id
        WHERE rt.booking_id = ?
        ORDER BY rt.id DESC
      `,
      [id],
    ),
    query("SELECT * FROM advance_payment WHERE booking_id = ? LIMIT 1", [id]),
  ]);

  const guest = guestRows[0] || null;
  const otherBooking = otherBookingRows[0] || null;
  const reference = referenceRows[0] || null;
  const company = companyRows[0] || null;
  const advance = advanceRows[0] || null;

  const paxByRoom = paxRows.reduce((acc, row) => {
    const key = String(row.room_number || "").trim();
    if (!key || acc[key]) return acc;
    acc[key] = {
      adults: Number(row.adults || 0),
      children: Number(row.children || 0),
      mealPlan: row.meal_plan || "EP",
    };
    return acc;
  }, {});

  const uniqueTariffRows = [];
  const seenRooms = new Set();

  tariffRows.forEach((row) => {
    const roomKey = String(row.room_number || "").trim();
    if (!roomKey || seenRooms.has(roomKey)) return;
    seenRooms.add(roomKey);
    uniqueTariffRows.push(row);
  });

  const roomTypeMap = {};
  const selectedRooms = {};
  const paxRooms = [];
  const roomTariff = uniqueTariffRows.map((row) => {
    const roomNumber = String(row.room_number || "").trim();
    const roomTypeId = row.roomTypeId ? String(row.roomTypeId) : "unassigned";
    const roomTypeName = row.roomTypeName || `Room Type ${roomTypeId}`;

    roomTypeMap[roomTypeId] = roomTypeName;
    selectedRooms[roomTypeId] = [...(selectedRooms[roomTypeId] || []), roomNumber];

    paxRooms.push({
      name: roomNumber,
      roomTypeId,
      roomTypeName,
    });

    return {
      roomNo: roomNumber,
      roomType: roomTypeName,
      roomTypeId,
      quantity: Number(row.quantity || 1),
      price: Number(row.tariff || 0),
      gst: Number(row.gst || 0),
      unitLabel: row.unitLabel || "PER NIGHT",
    };
  });

  const totalAmount = roomTariff.reduce((sum, row) => {
    const base = Number(row.price || 0) * Number(row.quantity || 0);
    return sum + base + (base * Number(row.gst || 0)) / 100;
  }, 0);

  const paidAmount = Number(advance?.amount || 0);
  const discountAmount = Number(advance?.discount_amount || 0);

  return {
    bookingId: guest?.id || Number(id),
    bookingCode: guest?.booking_code || "",
    guest: guest
      ? {
          agentBooking: false,
          bookingPoint: guest.booking_point || "",
          mobile: guest.mobile || "",
          guestName: guest.guest_name || "",
          guestEmail: guest.guest_email || "",
          checkIn: guest.check_in || "",
          checkOut: guest.check_out || "",
          arrival: guest.arrival || "12:00",
          departure: guest.departure || "10:00",
          bookingStatus: guest.booking_status || "Pending",
        }
      : null,
    otherBooking: otherBooking
      ? {
          bookingType: otherBooking.booking_type || "",
          bookingSource: otherBooking.booking_source || "",
          bookingReference: otherBooking.booking_reference || "",
          address: otherBooking.address || "",
          country: otherBooking.country || "",
          state: otherBooking.state || "",
          city: otherBooking.city || "",
          pincode: otherBooking.pincode || "",
        }
      : null,
    reference: reference
      ? {
          guestType: reference.guest_type || "",
          guestNotes: reference.guest_notes || "",
          internalNotes: reference.internal_notes || "",
        }
      : null,
    company: company
      ? {
          companyName: company.company_name || "Direct Booking",
          gst: company.gstin || "",
        }
      : null,
    roomSelection: {
      selectedRooms,
      roomTypeMap,
    },
    pax: {
      rooms: paxRooms,
      paxData: paxByRoom,
    },
    roomTariff: {
      rows: roomTariff,
      totalAmount,
    },
    advance: {
      paidAmount,
      discountAmount,
      paymentMode: advance?.payment_mode || "Cash",
      notes: advance?.remarks || "",
      totalAmount,
      remainingAmount: Math.max(totalAmount - paidAmount - discountAmount, 0),
    },
  };
};

const updateRoomsForBooking = async (booking, nextStatus) => {
  const roomNumbers = String(booking?.rooms || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  for (const roomNumber of roomNumbers) {
    if (nextStatus === "Checked In") {
      await roomInventoryModel.updateRoomOperationalState({
        roomNumber,
        guestName: booking.guest_name || null,
        status: "Occupied",
        checkIn: booking.check_in || null,
        checkOut: booking.check_out || null,
      });

      await query(
        "UPDATE housekeeping SET status = ? WHERE CAST(roomNo AS CHAR) = CAST(? AS CHAR)",
        ["Occupied Dirty", roomNumber],
      );
      continue;
    }

    await roomInventoryModel.updateRoomOperationalState({
      roomNumber,
      guestName: null,
      status: "Cleaning",
      checkIn: null,
      checkOut: null,
    });

    await query(
      "UPDATE housekeeping SET status = ? WHERE CAST(roomNo AS CHAR) = CAST(? AS CHAR)",
      ["Vacant Dirty", roomNumber],
    );
  }
};

exports.createGuest = (req, res) => {
  GuestModel.createGuest(req.body, (err, result) => {
    if (err) {
      console.error("[createGuest] DB error:", err);
      return res.status(500).json({
        message: "Guest creation failed",
        error: err.message,
        code: err.code,
        sqlState: err.sqlState,
        errno: err.errno,
      });
    }

    const bookingId = result.insertId;
    const wantsAutoInvoice =
      String(req.body?.sendInvoice || "").toLowerCase() === "true" ||
      req.body?.sendInvoice === true ||
      req.body?.sendInvoice === 1;

    // Auto-send WhatsApp invoice to customer + admin if requested.
    // Runs in the background; does NOT block the response.
    if (bookingId && wantsAutoInvoice) {
      setImmediate(async () => {
        try {
          const Invoice = require("../models/InvoiceModel");
          const InvoicePdf = require("../services/invoicePdfService");
          const WhatsApp = require("../services/whatsappService");
          const UserModel = require("../models/UserModel");

          const invoice = await Invoice.generateCustomerInvoice(bookingId);
          if (!invoice) return;

          const pdf = await InvoicePdf.generateInvoicePdf(invoice);
          const publicBase =
            (process.env.PUBLIC_BASE_URL ||
              process.env.PUBLIC_URL ||
              process.env.CLIENT_URL ||
              `http://localhost:${process.env.PORT || 5002}`
            ).replace(/\/+$/, "");
          const fileUrl = `${publicBase}/uploads/invoices/${pdf.fileName}`;

          // Resolve admin's WhatsApp number from their profile (register.phone)
          let adminNumber = "";
          try {
            const adminRows = await new Promise((resolve, reject) => {
              UserModel.findAdminUser((err, rows) =>
                err ? reject(err) : resolve(rows),
              );
            });
            adminNumber = adminRows?.[0]?.phone || "";
          } catch (e) {
            // ignore — service will return a "no admin number" reason
          }

          await WhatsApp.sendInvoiceNotifications(
            invoice,
            { fileUrl, fileName: pdf.fileName, filePath: pdf.filePath },
            { adminNumber },
          );
          if (process.env.NODE_ENV !== "test") {
            console.log(
              `[auto-whatsapp] invoice ${invoice.invoiceNo || bookingId} delivered`,
            );
          }
        } catch (autoErr) {
          console.error(
            "[auto-whatsapp] auto-send failed for booking",
            bookingId,
            autoErr.message || autoErr,
          );
        }
      });
    }

    res.json({
      message: "Guest Created",
      bookingId,
      bookingCode: result.bookingCode,
    });
  });
};

exports.updateOtherBooking = (req, res) => {
  const data = {
    guest_id: req.params.id,
    booking_id: req.params.id,
    ...req.body,
  };

  OtherBookingModel.createOtherBooking(data, (err) => {
    if (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Other booking save failed:", err);
      }
      return res.status(500).json({ message: "Other booking failed" });
    }

    res.json({ message: "Other Booking Saved" });
  });
};

exports.updateReference = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  ReferenceModel.createReference(data, (err) => {
    if (err) {
      return res.status(500).json({ message: "Reference save failed" });
    }

    res.json({ message: "Reference Saved" });
  });
};

exports.updateCompany = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  if (!data.companyName && !data.company_name) {
    return res.status(400).json({
      message: "Company name is required",
    });
  }

  CompanyModel.addCompany(data, (err, result) => {
    if (err) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Company save failed:", err);
      }

      return res.status(500).json({
        message: "Company save failed",
        error: err.message,
      });
    }

    res.json({
      message: "Company Added",
      id: result.insertId,
    });
  });
};

exports.updatePax = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  PaxModel.addPax(data, (err) => {
    if (err) {
      return res.status(500).json({ message: "Pax save failed" });
    }

    res.json({ message: "Pax Added" });
  });
};

exports.updateTariff = async (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };
  const bookingId = Number(req.params.id);
  const roomNumber = String(data.roomNumber || "").trim();

  if (!roomNumber) {
    return res.status(400).json({ message: "Room number required" });
  }

  try {
    // OVERLAP CHECK: prevent double-booking the same room for overlapping dates.
    // Skips the current booking so editing an existing booking doesn't collide with itself.
    const guestRows = await query(
      "SELECT check_in, check_out FROM guests WHERE id = ? LIMIT 1",
      [bookingId],
    );

    if (guestRows.length && guestRows[0].check_in && guestRows[0].check_out) {
      const checkIn = String(guestRows[0].check_in).slice(0, 10);
      const checkOut = String(guestRows[0].check_out).slice(0, 10);

      const overlap = await roomInventoryModel.validateRoomAvailability({
        roomNumbers: [roomNumber],
        checkIn,
        checkOut,
        excludeBookingId: bookingId,
      });

      if (!overlap.available && overlap.conflicts.length) {
        const conflict = overlap.conflicts[0];
        return res.status(409).json({
          message: `Room ${conflict.roomNumber} is already occupied from ${String(conflict.check_in).slice(0, 10)} to ${String(conflict.check_out).slice(0, 10)} by ${conflict.guest_name || "another guest"}. This room is not available for the selected dates.`,
          conflict: conflict,
        });
      }
    }

    RoomTariffModel.addTariff(data, (err) => {
      if (err) {
        return res.status(500).json({ message: "Tariff save failed" });
      }

      res.json({ message: "Tariff Added" });
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("updateTariff failed:", error);
    }
    res.status(500).json({ message: "Tariff save failed", error: error.message });
  }
};

exports.getAllBookings = async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        g.id AS bookingId,
        g.booking_code AS bookingCode,
        g.guest_name,
        g.mobile,
        g.guest_email,
        DATE_FORMAT(g.check_in, '%Y-%m-%d') AS check_in,
        DATE_FORMAT(g.check_out, '%Y-%m-%d') AS check_out,
        g.booking_status,
        c.company_name,
        ob.booking_type AS bookingType,
        COALESCE(rt.totalAmount, 0) AS totalAmount,
        IFNULL(a.amount, 0) AS paidAmount,
        IFNULL(a.discount_amount, 0) AS discountAmount,
        IFNULL(a.refund_amount, 0) AS refundAmount,
        COALESCE(NULLIF(a.payment_mode, ''), 'Pending') AS paymentMode,
        (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) AS netPaid,
        (
          COALESCE(rt.totalAmount, 0) -
          ((IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) + IFNULL(a.discount_amount, 0))
        ) AS remainingAmount,
        COALESCE(NULLIF(rt.rooms, ''), NULLIF(px.rooms, ''), '') AS rooms,
        COALESCE(NULLIF(rt.rooms, ''), NULLIF(px.rooms, ''), '') AS roomDetails
      FROM guests g
      LEFT JOIN (
        SELECT booking_id, MAX(company_name) AS company_name
        FROM companies
        GROUP BY booking_id
      ) c ON g.id = c.booking_id
      LEFT JOIN (
        SELECT guest_id, MAX(booking_type) AS booking_type
        FROM other_booking
        GROUP BY guest_id
      ) ob ON g.id = ob.guest_id
      LEFT JOIN advance_payment a ON g.id = a.booking_id
      LEFT JOIN (
        SELECT
          rt.booking_id,
          COALESCE(
            SUM(
              (rt.tariff * rt.quantity * COALESCE(GREATEST(TIMESTAMPDIFF(DAY, g.check_in, g.check_out), 1), 1))
              + (rt.tariff * rt.quantity * (rt.gst / 100) * COALESCE(GREATEST(TIMESTAMPDIFF(DAY, g.check_in, g.check_out), 1), 1))
            ),
            0
          ) AS totalAmount,
          GROUP_CONCAT(DISTINCT CAST(rt.room_number AS CHAR) ORDER BY room_number SEPARATOR ', ') AS rooms
        FROM room_tariff rt
        INNER JOIN guests g ON g.id = rt.booking_id
        GROUP BY rt.booking_id
      ) rt ON g.id = rt.booking_id
      LEFT JOIN (
        SELECT
          booking_id,
          GROUP_CONCAT(DISTINCT CAST(room_number AS CHAR) ORDER BY room_number SEPARATOR ', ') AS rooms
        FROM pax
        WHERE NULLIF(TRIM(CAST(room_number AS CHAR)), '') IS NOT NULL
        GROUP BY booking_id
      ) px ON g.id = px.booking_id
      WHERE LOWER(IFNULL(g.booking_status, 'confirmed')) NOT IN ('checked out', 'cancelled')
      ORDER BY g.id DESC
    `);

    res.json(result);
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const result = await query("SELECT * FROM guests WHERE id = ?", [req.params.id]);
    res.json(result[0] || null);
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.getBookingWizard = async (req, res) => {
  try {
    const payload = await getBookingWizardDataById(req.params.id);
    res.json(payload);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Booking wizard fetch failed:", error);
    }
    res.status(500).json({ message: "Booking wizard fetch failed", error: error.message });
  }
};

exports.updateBooking = async (req, res) => {
  const { guest_name, mobile } = req.body;

  try {
    await query(
      "UPDATE guests SET guest_name = ?, mobile = ? WHERE id = ?",
      [guest_name, mobile, req.params.id],
    );
    res.json({ message: "Updated Successfully" });
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.getFullBooking = async (req, res) => {
  const id = req.params.id;

  try {
    await ensureBookingWizardSchema();

    const summaryResult = await query(
      `
        SELECT
          g.id AS bookingId,
          g.booking_code AS bookingCode,
          g.booking_code,
          g.guest_name,
          g.mobile,
          g.guest_email,
          DATE_FORMAT(g.check_in, '%Y-%m-%d') AS check_in,
          DATE_FORMAT(g.check_out, '%Y-%m-%d') AS check_out,
          g.arrival,
          g.departure,
          g.booking_status,
          ob.booking_type,
          ob.booking_source,
          ob.booking_reference,
          ob.address,
          rn.guest_notes,
          rn.internal_notes,
          c.company_name,
          c.gstin AS company_gst,
          IFNULL(a.amount, 0) AS paidAmount,
          IFNULL(a.discount_amount, 0) AS discountAmount,
          IFNULL(a.refund_amount, 0) AS refundAmount,
          a.payment_mode AS paymentMode,
          a.remarks AS paymentRemarks,
          SUM(rt.total) AS totalAmount,
          (
            SUM(rt.total) -
            ((IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) + IFNULL(a.discount_amount, 0))
          ) AS remainingAmount
        FROM guests g
        LEFT JOIN other_booking ob ON g.id = ob.guest_id
        LEFT JOIN reference_notes rn ON g.id = rn.guest_id
        LEFT JOIN companies c ON g.id = c.booking_id
        LEFT JOIN advance_payment a ON g.id = a.booking_id
        LEFT JOIN room_tariff rt ON g.id = rt.booking_id
        WHERE g.id = ?
        GROUP BY
          g.id,
          g.booking_code,
          g.guest_name,
          g.mobile,
          g.guest_email,
          g.check_in,
          g.check_out,
          g.arrival,
          g.departure,
          g.booking_status,
          ob.booking_type,
          ob.booking_source,
          ob.booking_reference,
          ob.address,
          rn.guest_notes,
          rn.internal_notes,
          c.company_name,
          c.gstin,
          a.amount,
          a.discount_amount,
          a.refund_amount,
          a.payment_mode,
          a.remarks
        LIMIT 1
      `,
      [id],
    );

    const roomsResult = await query(
      `
        SELECT
          rt.room_number,
          IFNULL(hri.id, rt.room_number) AS roomId,
          hrc.name AS roomType,
          rt.tariff,
          rt.gst,
          rt.total,
          rt.quantity,
          p.adults,
          p.children,
          p.meal_plan
        FROM room_tariff rt
        LEFT JOIN pax p
          ON rt.booking_id = p.booking_id
         AND rt.room_number = p.room_number
        LEFT JOIN hotel_room_inventory hri
          ON CAST(hri.room_number AS CHAR) = CAST(rt.room_number AS CHAR)
        LEFT JOIN hotel_room_categories hrc
          ON hrc.id = hri.category_id
        WHERE rt.booking_id = ?
        ORDER BY rt.room_number ASC
      `,
      [id],
    );

    // Aggregate guestCapacity (sum of adults + children across all rooms)
    const paxSumRows = await query(
      `SELECT
         IFNULL(SUM(adults), 0) AS adults,
         IFNULL(SUM(children), 0) AS children
       FROM pax WHERE booking_id = ?`,
      [id],
    );
    const paxSum = paxSumRows[0] || { adults: 0, children: 0 };
    const guestCapacity = `${Number(paxSum.adults || 0) + Number(paxSum.children || 0)} (${Number(paxSum.adults || 0)} Adults + ${Number(paxSum.children || 0)} Children)`;

    const summary = summaryResult[0] || {};
    const nights =
      summary.check_in && summary.check_out
        ? Math.max(
            Math.round(
              (new Date(summary.check_out) - new Date(summary.check_in)) / (1000 * 60 * 60 * 24),
            ),
            1,
          )
        : 1;

    // Recompute total per-row AND overall total using per-night tariff * nights * qty + GST,
    // since `room_tariff.total` is stored as the **single-night** total only.
    const enrichedRooms = (roomsResult || []).map((row) => {
      const tariff = Number(row.tariff || 0);
      const qty = Number(row.quantity || 1);
      const gst = Number(row.gst || 0);
      const perNightBase = tariff * qty;
      const perNightGst = (perNightBase * gst) / 100;
      const rowTotal = perNightBase * nights + perNightGst * nights;
      return {
        ...row,
        nights,
        rowTotal,
      };
    });

    const storedTotal = Number(summary.totalAmount || 0);
    const recalculatedTotal = enrichedRooms.reduce(
      (sum, r) => sum + Number(r.rowTotal || 0),
      0,
    );

    res.json({
      ...summary,
      guestCapacity,
      nights,
      rooms: enrichedRooms,
      // If we have enriched rows, prefer the recalculated multi-night total;
      // otherwise fall back to whatever the backend summed up.
      totalAmount: recalculatedTotal > 0 ? recalculatedTotal : storedTotal,
    });
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.updateFullBooking = async (req, res) => {
  const id = req.params.id;
  const {
    guest_name,
    guest_email,
    mobile,
    company_name,
    rooms,
    paidAmount,
    discountAmount,
    paymentMode,
    paymentRemarks,
    checkIn,
    checkOut,
    arrival,
    departure,
    bookingType,
    bookingSource,
    bookingReference,
    address,
    guestNotes,
    internalNotes,
  } = req.body;

  const roomList = Array.isArray(rooms)
    ? rooms
    : String(rooms || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  try {
    // OVERLAP CHECK for edit mode: validate rooms against new date range
    const roomNumbers = roomList
      .map((room) => String(room.room_number || room.roomNumber || "").trim())
      .filter(Boolean);

    let effectiveCheckIn = checkIn;
    let effectiveCheckOut = checkOut;
    if (!effectiveCheckIn || !effectiveCheckOut) {
      const currentGuestRows = await query(
        "SELECT check_in, check_out FROM guests WHERE id = ? LIMIT 1",
        [id],
      );
      if (currentGuestRows.length) {
        effectiveCheckIn = effectiveCheckIn || currentGuestRows[0].check_in;
        effectiveCheckOut = effectiveCheckOut || currentGuestRows[0].check_out;
      }
    }

    if (roomNumbers.length && effectiveCheckIn && effectiveCheckOut) {
      const overlap = await roomInventoryModel.validateRoomAvailability({
        roomNumbers,
        checkIn: String(effectiveCheckIn).slice(0, 10),
        checkOut: String(effectiveCheckOut).slice(0, 10),
        excludeBookingId: Number(id),
      });

      if (!overlap.available && overlap.conflicts.length) {
        const conflict = overlap.conflicts[0];
        return res.status(409).json({
          message: `Room ${conflict.roomNumber} is already occupied from ${String(conflict.check_in).slice(0, 10)} to ${String(conflict.check_out).slice(0, 10)}. This room is not available for the selected dates.`,
          conflict: conflict,
        });
      }
    }

    await query(
      `
        UPDATE guests
        SET guest_name = ?,
            guest_email = COALESCE(?, guest_email),
            mobile = ?,
            check_in = COALESCE(?, check_in),
            check_out = COALESCE(?, check_out),
            arrival = COALESCE(?, arrival),
            departure = COALESCE(?, departure)
        WHERE id = ?
      `,
      [
        guest_name,
        guest_email ?? null,
        mobile,
        checkIn ?? null,
        checkOut ?? null,
        arrival ?? null,
        departure ?? null,
        id,
      ],
    );

    await query(
      "UPDATE companies SET company_name = ? WHERE booking_id = ?",
      [company_name || "Direct Booking", id],
    );

    // Overwrite advance_payment so editing the amount does NOT stack on top
    // of the old value (which is what ON DUPLICATE KEY UPDATE ... amount =
    // amount + VALUES(amount) does in addAdvance).
    // 🐛 FIX: previously ran unconditionally on every booking edit, using
    // `paidAmount ?? 0` / `paymentMode || "Cash"` as silent defaults. If a
    // caller didn't explicitly send these fields (as the Edit Booking save
    // used to), this wiped the booking's real advance back to ₹0/"Cash".
    // Now only touches advance_payment when the request actually included
    // payment info, so an edit that doesn't touch payment can't erase it.
    const paymentFieldsProvided =
      paidAmount !== undefined || discountAmount !== undefined || paymentMode !== undefined;
    const existingAdv = paymentFieldsProvided
      ? await query("SELECT booking_id FROM advance_payment WHERE booking_id = ? LIMIT 1", [id])
      : [];
    if (paymentFieldsProvided && existingAdv.length) {
      await query(
        `UPDATE advance_payment
           SET amount = ?,
               discount_amount = COALESCE(?, discount_amount),
               payment_mode = ?,
               remarks = ?
         WHERE booking_id = ?`,
        [
          Number(paidAmount ?? 0),
          Number(discountAmount ?? 0),
          paymentMode || "Cash",
          paymentRemarks || null,
          id,
        ],
      );
    } else if (paymentFieldsProvided && Number(paidAmount ?? 0) > 0) {
      await query(
        `INSERT INTO advance_payment (booking_id, amount, discount_amount, payment_mode, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [id, Number(paidAmount ?? 0), Number(discountAmount ?? 0), paymentMode || "Cash", paymentRemarks || null],
      );
    }

    // 🐛 FIX: advance_payment was being updated correctly above, but
    // payment_history — the table Accounts.jsx's transaction log actually
    // reads for "Hotel payment received" entries — was never touched by
    // this Edit Booking save path. So changing the payment mode (Cash ->
    // Card, Card -> UPI, etc.) here updated the booking/advance itself, but
    // the Accounts page kept showing the OLD payment mode/amount forever.
    // Only sync when there's something to record (an actual paid amount).
    if (Number(paidAmount ?? 0) > 0 || Number(discountAmount ?? 0) > 0) {
      await query("DELETE FROM payment_history WHERE booking_id = ?", [id]);
      await query(
        `INSERT INTO payment_history (booking_id, amount, discount_amount, payment_mode)
         VALUES (?, ?, ?, ?)`,
        [id, Number(paidAmount ?? 0), Number(discountAmount ?? 0), paymentMode || "Cash"],
      );
    }

    // Upsert other_booking (type / source / address)
    const otherExisting = await query(
      "SELECT id FROM other_booking WHERE guest_id = ? LIMIT 1",
      [id],
    );
    if (otherExisting.length) {
      await query(
        `UPDATE other_booking
           SET booking_type    = COALESCE(?, booking_type),
               booking_source  = COALESCE(?, booking_source),
               booking_reference = COALESCE(?, booking_reference),
               address         = COALESCE(?, address)
         WHERE guest_id = ?`,
        [bookingType ?? null, bookingSource ?? null, bookingReference ?? null, address ?? null, id],
      );
    } else if (bookingType || bookingSource || address) {
      await query(
        `INSERT INTO other_booking (guest_id, booking_type, booking_source, booking_reference, address)
         VALUES (?, ?, ?, ?, ?)`,
        [id, bookingType || null, bookingSource || null, bookingReference || null, address || null],
      );
    }

    // Upsert reference_notes
    const refExisting = await query(
      "SELECT id FROM reference_notes WHERE guest_id = ? LIMIT 1",
      [id],
    );
    if (refExisting.length) {
      await query(
        `UPDATE reference_notes
           SET guest_notes    = COALESCE(?, guest_notes),
               internal_notes = COALESCE(?, internal_notes)
         WHERE guest_id = ?`,
        [guestNotes ?? null, internalNotes ?? null, id],
      );
    } else if (guestNotes || internalNotes) {
      await query(
        `INSERT INTO reference_notes (guest_id, guest_notes, internal_notes) VALUES (?, ?, ?)`,
        [id, guestNotes || null, internalNotes || null],
      );
    }

    if (roomList.length) {
      for (const room of roomList) {
        const roomNo = String(room.room_number || room.roomNumber || "").trim();
        if (!roomNo) continue;

        await query(
          `
            UPDATE room_tariff
            SET tariff = ?, gst = ?, total = ?
            WHERE booking_id = ? AND room_number = ?
          `,
          [room.tariff, room.gst, room.total, id, roomNo],
        );

        // Upsert pax so adults/children persist per room even when no row exists yet
        const paxExisting = await query(
          "SELECT id FROM pax WHERE booking_id = ? AND room_number = ? LIMIT 1",
          [id, roomNo],
        );
        if (paxExisting.length) {
          await query(
            `UPDATE pax SET adults = ?, children = ?
               WHERE booking_id = ? AND room_number = ?`,
            [Number(room.adults || 0), Number(room.children || 0), id, roomNo],
          );
        } else {
          await query(
            `INSERT INTO pax (booking_id, room_number, adults, children, meal_plan)
               VALUES (?, ?, ?, ?, ?)`,
            [id, roomNo, Number(room.adults || 1), Number(room.children || 0), room.mealPlan || null],
          );
        }
      }
    }

    const updatedBooking = await getBookingSummaryById(id);
    const syncedRoomNumbers = roomList.length
      ? roomList
          .map((room) => String(room.room_number || room.roomNumber || "").trim())
          .filter(Boolean)
      : String(updatedBooking?.rooms || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    const shouldSyncRoomState =
      Boolean(checkIn || checkOut) &&
      updatedBooking &&
      String(updatedBooking.booking_status || "").toLowerCase().includes("checked in");

    if (shouldSyncRoomState && syncedRoomNumbers.length) {
      await Promise.all(
        syncedRoomNumbers.map((roomNumber) =>
          roomInventoryModel.updateRoomOperationalState({
            roomNumber,
            guestName: updatedBooking.guest_name || null,
            status: "Occupied",
            checkIn: updatedBooking.check_in || null,
            checkOut: updatedBooking.check_out || null,
          }),
        ),
      );
    }

    res.json({ message: "Full Booking Updated" });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(error);
    }
    res.status(500).json({ message: "Full booking update failed", error: error.message });
  }
};

exports.deleteBooking = async (req, res) => {
  const id = req.params.id;

  try {
    await query("DELETE FROM guests WHERE id = ?", [id]);
    await query("DELETE FROM companies WHERE booking_id = ?", [id]);
    await query("DELETE FROM pax WHERE booking_id = ?", [id]);
    await query("DELETE FROM room_tariff WHERE booking_id = ?", [id]);
    await query("DELETE FROM advance_payment WHERE booking_id = ?", [id]);

    res.json({ message: "Booking Deleted" });
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.refundBooking = async (req, res) => {
  const id = req.params.id;
  const { amount } = req.body;

  try {
    await query(
      `
        UPDATE advance_payment
        SET refund_amount = IFNULL(refund_amount, 0) + ?
        WHERE booking_id = ?
      `,
      [amount, id],
    );

    res.json({ message: "Refund Done" });
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.updateAdvance = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  Paymentadvance.addPayment(data, (paymentError) => {
    if (paymentError) {
      if (process.env.NODE_ENV !== "test") {
        console.error(paymentError);
      }
      return res.status(500).json({
        message: "Payment history failed",
        error: paymentError.message,
      });
    }

    AdvanceModel.addAdvance(data, (advanceError) => {
      if (advanceError) {
        if (process.env.NODE_ENV !== "test") {
          console.error(advanceError);
        }
        return res.status(500).json({
          message: "Advance save failed",
          error: advanceError.message,
        });
      }

      // Respond immediately — invoice + WhatsApp run in the background so a
      // slow PDF generator or WhatsApp API never blocks the booking save.
      res.json({ message: "Payment Added + History Saved" });

      setImmediate(async () => {
        try {
          const invoice = await InvoiceModel.generateCustomerInvoice(Number(req.params.id));
          if (!invoice) return;
          const pdf = await InvoicePdfService.generateInvoicePdf(invoice);
          const publicBase =
            (process.env.PUBLIC_BASE_URL ||
              process.env.CLIENT_URL ||
              `http://localhost:${process.env.PORT || 5002}`
            ).replace(/\/+$/, "");
          const fileUrl = `${publicBase}/uploads/invoices/${pdf.fileName}`;
          const filePath = pdf.filePath;
          const guestName = invoice.customerName || "Valued Guest";
          const message = `Dear ${guestName},\n\nThank you for staying at Maa Baglamukhi Resort.\n\nYour invoice ${invoice.invoiceNo || ""} is attached.\nTotal: ₹${invoice.totalAmount?.toFixed(2) || "0.00"}\n\nRegards,\nMaa Baglamukhi Resort`;
          const customer = WhatsAppService.normalizePhoneNumber(invoice.phone);
          if (customer) {
            await WhatsAppService.sendWhatsAppMessage({
              number: customer,
              message,
              fileUrl,
              filePath,
              fileName: pdf.fileName,
            });
          }
          // Resolve admin phone from register table (not from env/ADMIN_WHATSAPP_NUMBER)
          let adminNumber = "";
          try {
            const adminRows = await new Promise((resolve, reject) => {
              UserModel.findAdminUser((err, rows) =>
                err ? reject(err) : resolve(rows),
              );
            });
            adminNumber = adminRows?.[0]?.phone || "";
          } catch (e) {
            // ignore — service will return a "no admin number" reason
          }

          await WhatsAppService.sendInvoiceNotifications(
            invoice,
            { fileUrl, fileName: pdf.fileName, filePath: pdf.filePath },
            { adminNumber },
          );
          if (process.env.NODE_ENV !== "test") {
            console.log(
              `[auto-whatsapp] invoice ${invoice.invoiceNo || req.params.id} delivered`,
            );
          }
        } catch (autoErr) {
          console.error(
            "[auto-whatsapp] fire-after-payment error for booking",
            req.params.id,
            autoErr.message || autoErr,
          );
        }
      });

      // Auto-print advance payment receipt
      setImmediate(async () => {
        try {
          const { InvoicePrintService } = require("../services/InvoicePrintService");
          const booking = await getBookingSummaryById(req.params.id);
          await InvoicePrintService.immediatePrintInvoice("advance_payment", {
            bookingId: req.params.id,
            invoiceNo: `ADV-${req.params.id}`,
            customerName: booking?.guest_name || "Guest",
            phone: booking?.mobile || "",
            roomNumber: booking?.rooms || "",
            totalAmount: Number(data.amount || data.paidAmount || 0),
            discount: Number(data.discountAmount || data.discount_amount || 0),
            subtotal: Number(data.amount || data.paidAmount || 0),
            tax: 0,
            paymentMode: data.paymentMode || "Cash",
            paymentStatus: "Paid",
            printedBy: "System (Advance)",
          });
        } catch (err) {
          console.error("[auto-print] advance receipt failed:", err.message);
        }
      });
    });
  });
};

exports.checkInBooking = async (req, res) => {
  try {
    const booking = await getBookingSummaryById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    await query("UPDATE guests SET booking_status = ? WHERE id = ?", ["Checked In", req.params.id]);
    await updateRoomsForBooking(booking, "Checked In");

    // Auto-print guest registration form after check-in
    setImmediate(async () => {
      try {
        const { InvoicePrintService } = require("../services/InvoicePrintService");
        await InvoicePrintService.immediatePrintInvoice("guest_registration", {
          bookingId: req.params.id,
          customerName: booking.guest_name,
          phone: booking.mobile,
          roomNumber: booking.rooms,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          printedBy: "System (Check-in)",
        });
      } catch (err) {
        console.error("[auto-print] check-in registration failed:", err.message);
      }
    });

    res.json({ message: "Booking checked in successfully" });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(error);
    }
    res.status(500).json({ message: "Check-in failed" });
  }
};

exports.checkOutBooking = async (req, res) => {
  try {
    const booking = await getBookingSummaryById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    await query("UPDATE guests SET booking_status = ? WHERE id = ?", ["Checked Out", req.params.id]);
    await updateRoomsForBooking(booking, "Checked Out");

    // Auto-print final invoice after check-out
    setImmediate(async () => {
      try {
        const { InvoicePrintService } = require("../services/InvoicePrintService");
        const Invoice = require("../models/InvoiceModel");

        // Generate and print the final invoice
        const invoice = await Invoice.generateCustomerInvoice(Number(req.params.id));
        if (invoice) {
          await InvoicePrintService.immediatePrintInvoice("checkout_bill", {
            ...invoice,
            printedBy: "System (Check-out)",
          });
        }
      } catch (err) {
        console.error("[auto-print] check-out invoice failed:", err.message);
      }
    });

    res.json({ message: "Booking checked out successfully" });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(error);
    }
    res.status(500).json({ message: "Check-out failed" });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await getBookingSummaryById(req.params.id);
    const cancelReason = String(req.body?.reason || "").trim();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!cancelReason) {
      return res.status(400).json({ message: "Cancellation reason is required" });
    }

    if (String(booking.booking_status || "").toLowerCase().includes("checked in")) {
      return res.status(400).json({ message: "Checked-in booking cannot be cancelled from this flow" });
    }

    await query(
      "UPDATE guests SET booking_status = ?, cancel_reason = ? WHERE id = ?",
      ["Cancelled", cancelReason, req.params.id],
    );

    const roomNumbers = String(booking?.rooms || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    await Promise.all(
      roomNumbers.map(async (roomNumber) => {
        await roomInventoryModel.updateRoomOperationalState({
          roomNumber,
          guestName: null,
          status: "Available",
          checkIn: null,
          checkOut: null,
        });

        await query(
          "UPDATE housekeeping SET status = ? WHERE CAST(roomNo AS CHAR) = CAST(? AS CHAR)",
          ["Vacant Clean", roomNumber],
        );
      }),
    );

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error(error);
    }
    res.status(500).json({ message: "Booking cancellation failed" });
  }
};

exports.getBookingHistory = async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        g.id AS bookingId,
        g.booking_code AS bookingCode,
        g.guest_name,
        g.mobile,
        g.guest_email,
        DATE_FORMAT(g.check_in, '%Y-%m-%d') AS check_in,
        DATE_FORMAT(g.check_out, '%Y-%m-%d') AS check_out,
        g.booking_status,
        c.company_name,
        COALESCE(SUM(rt.total), 0) AS totalAmount,
        IFNULL(a.amount, 0) AS paidAmount,
        IFNULL(a.discount_amount, 0) AS discountAmount,
        IFNULL(a.refund_amount, 0) AS refundAmount,
        COALESCE(NULLIF(a.payment_mode, ''), 'Pending') AS paymentMode,
        (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) AS netPaid,
        (
          SUM(rt.total) -
          ((IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) + IFNULL(a.discount_amount, 0))
        ) AS remainingAmount,
        GROUP_CONCAT(rt.room_number) AS rooms,
        GROUP_CONCAT(
          DISTINCT CONCAT(
            rt.room_number,
            ' | ID ',
            IFNULL(hri.id, '-'),
            ' | ',
            IFNULL(hrc.name, 'Room')
          )
          ORDER BY rt.room_number SEPARATOR ' || '
        ) AS roomDetails
      FROM guests g
      LEFT JOIN companies c ON g.id = c.booking_id
      LEFT JOIN advance_payment a ON g.id = a.booking_id
      LEFT JOIN room_tariff rt ON g.id = rt.booking_id
      LEFT JOIN hotel_room_inventory hri ON CAST(hri.room_number AS CHAR) = CAST(rt.room_number AS CHAR)
      LEFT JOIN hotel_room_categories hrc ON hrc.id = hri.category_id
      WHERE LOWER(IFNULL(g.booking_status, '')) = 'checked out'
      GROUP BY
        g.id,
        g.booking_code,
        g.guest_name,
        g.mobile,
        g.guest_email,
        g.check_in,
        g.check_out,
        g.booking_status,
        c.company_name,
        a.amount,
        a.discount_amount,
        a.payment_mode,
        a.refund_amount
      ORDER BY g.id DESC
    `);

    res.json(result);
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.getPaymentHistory = async (req, res) => {
  const bookingId = req.params.id;

  try {
    const result = await query(
      `
        SELECT
          ph.id,
          ph.amount,
          IFNULL(ph.discount_amount, 0) AS discount_amount,
          ph.payment_mode,
          ph.created_at,
          g.guest_name,
          GROUP_CONCAT(DISTINCT rt.room_number ORDER BY rt.room_number) AS rooms
        FROM payment_history ph
        LEFT JOIN guests g ON ph.booking_id = g.id
        LEFT JOIN room_tariff rt ON ph.booking_id = rt.booking_id
        WHERE ph.booking_id = ?
        GROUP BY
          ph.id,
          ph.amount,
          ph.discount_amount,
          ph.payment_mode,
          ph.created_at,
          g.guest_name
        ORDER BY ph.id DESC
      `,
      [bookingId],
    );

    res.json(result);
  } catch (error) {
    res.status(500).json(error);
  }
};