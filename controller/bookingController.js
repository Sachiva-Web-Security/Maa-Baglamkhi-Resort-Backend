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
const { sendTemplate, getPublicBaseUrl } = require("../utils/whatsappNotify");

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
  // Normalize the payload so the Hotel/PMS "+ New Booking" form (which sends
  // `phone` + `room`) maps onto the fields GuestModel.createGuest expects
  // (`mobile`) and the room linkage tables get populated.
  const body = req.body || {};
  const normalizedBody = {
    ...body,
    mobile: body.mobile || body.phone || body.guest_mobile || body.contactNumber || null,
    guestName: body.guestName || body.guest_name || body.name || "",
  };

  GuestModel.createGuest(normalizedBody, async (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Guest creation failed" });
    }

    const bookingId = result.insertId;
    const roomNumber =
      body.room || body.room_no || body.roomNumber ||
      (Array.isArray(body.rooms) ? body.rooms[0] : null);
    const checkIn = body.checkIn || body.check_in || null;
    const checkOut = body.checkOut || body.check_out || null;
    const pricePerDay = Number(body.pricePerDay || body.price_per_day || 0) || 0;
    const guestName = normalizedBody.guestName;

    // Link the room to this booking (so it shows after refresh).
    // Done synchronously to keep state consistent; errors are logged but
    // don't fail the booking response since the guest row already exists.
    if (roomNumber && !result.reused) {
      try {
        // Compute nights + total for room_tariff
        const days =
          checkIn && checkOut
            ? Math.max(
                1,
                Math.ceil(
                  (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24),
                ),
              )
            : 1;
        const total = pricePerDay * days;

        await query(
          `INSERT INTO room_tariff
             (booking_id, room_number, date, quantity, category_name, tariff, gst, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bookingId,
            String(roomNumber),
            checkIn || null,
            days,
            "Room Charge",
            pricePerDay,
            0,
            total,
          ],
        );

        // Mark the physical room as Occupied so the Room Inventory grid
        // reflects the booking after a page refresh.
        await roomInventoryModel.updateRoomOperationalState({
          roomNumber,
          guestName,
          status: "Occupied",
          checkIn,
          checkOut,
        });
      } catch (linkErr) {
        if (process.env.NODE_ENV !== "test") {
          console.error("Room linkage on booking failed:", linkErr.message || linkErr);
        }
      }
    }

    // Fire-and-forget WhatsApp confirmation.
    const number = normalizedBody.mobile;
    if (number) {
      sendTemplate({
        code: "booking_confirmation",
        autoFlag: "auto_send_booking_confirmation",
        number,
        vars: {
          guest_name: guestName || "Guest",
          room_no: roomNumber || body.rooms || "—",
          checkin_date: checkIn || "",
          checkout_date: checkOut || "",
          booking_no: result.bookingCode || bookingId,
        },
      }).catch(() => {});
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

exports.updateTariff = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  RoomTariffModel.addTariff(data, (err) => {
    if (err) {
      return res.status(500).json({ message: "Tariff save failed" });
    }

    res.json({ message: "Tariff Added" });
  });
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
      LEFT JOIN advance_payment a ON g.id = a.booking_id
      LEFT JOIN (
        SELECT
          booking_id,
          COALESCE(SUM(total), 0) AS totalAmount,
          GROUP_CONCAT(DISTINCT CAST(room_number AS CHAR) ORDER BY room_number SEPARATOR ' || ') AS rooms
        FROM room_tariff
        GROUP BY booking_id
      ) rt ON g.id = rt.booking_id
      LEFT JOIN (
        SELECT
          booking_id,
          GROUP_CONCAT(DISTINCT CAST(room_number AS CHAR) ORDER BY room_number SEPARATOR ' || ') AS rooms
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
          g.booking_status,
          ob.booking_source,
          c.company_name,
          IFNULL(a.amount, 0) AS paidAmount,
          IFNULL(a.discount_amount, 0) AS discountAmount,
          IFNULL(a.refund_amount, 0) AS refundAmount,
          SUM(rt.total) AS totalAmount,
          (
            SUM(rt.total) -
            ((IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) + IFNULL(a.discount_amount, 0))
          ) AS remainingAmount
        FROM guests g
        LEFT JOIN other_booking ob ON g.id = ob.guest_id
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
          g.booking_status,
          ob.booking_source,
          c.company_name,
          a.amount,
          a.discount_amount,
          a.refund_amount
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
          p.adults,
          p.children
        FROM room_tariff rt
        LEFT JOIN pax p
          ON rt.booking_id = p.booking_id
         AND rt.room_number = p.room_number
        LEFT JOIN hotel_room_inventory hri
          ON CAST(hri.room_number AS CHAR) = CAST(rt.room_number AS CHAR)
        LEFT JOIN hotel_room_categories hrc
          ON hrc.id = hri.category_id
        WHERE rt.booking_id = ?
      `,
      [id],
    );

    res.json({
      ...(summaryResult[0] || {}),
      rooms: roomsResult,
    });
  } catch (error) {
    res.status(500).json(error);
  }
};

exports.updateFullBooking = async (req, res) => {
  const id = req.params.id;
  const {
    guest_name,
    mobile,
    company_name,
    rooms,
    paidAmount,
    checkIn,
    checkOut,
    arrival,
    departure,
  } = req.body;

  const roomList = Array.isArray(rooms)
    ? rooms
    : String(rooms || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  try {
    await query(
      `
        UPDATE guests
        SET guest_name = ?,
            mobile = ?,
            check_in = COALESCE(?, check_in),
            check_out = COALESCE(?, check_out),
            arrival = COALESCE(?, arrival),
            departure = COALESCE(?, departure)
        WHERE id = ?
      `,
      [guest_name, mobile, checkIn ?? null, checkOut ?? null, arrival ?? null, departure ?? null, id],
    );

    await query("UPDATE companies SET company_name = ? WHERE booking_id = ?", [company_name, id]);
    await query("UPDATE advance_payment SET amount = ? WHERE booking_id = ?", [paidAmount, id]);

    if (roomList.length) {
      for (const room of roomList) {
        await query(
          `
            UPDATE room_tariff
            SET tariff = ?, gst = ?, total = ?
            WHERE booking_id = ? AND room_number = ?
          `,
          [room.tariff, room.gst, room.total, id, room.room_number],
        );

        await query(
          `
            UPDATE pax
            SET adults = ?, children = ?
            WHERE booking_id = ? AND room_number = ?
          `,
          [room.adults, room.children, id, room.room_number],
        );
      }
    }

    const updatedBooking = await getBookingSummaryById(id);
    const roomNumbers = roomList.length
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

    if (shouldSyncRoomState && roomNumbers.length) {
      await Promise.all(
        roomNumbers.map((roomNumber) =>
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

  Promise.all([AdvanceModel.ensureSchema(), Paymentadvance.ensureSchema()])
    .then(() => {
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

          InvoiceModel.generateCustomerInvoice(Number(req.params.id))
            .then(() =>
              res.json({
                message: "Payment Added + History Saved",
              }),
            )
            .catch((invoiceError) => {
              if (process.env.NODE_ENV !== "test") {
                console.error(invoiceError);
              }

              return res.status(500).json({
                message: "Invoice sync failed after payment save",
                error: invoiceError.message,
              });
            });
        });
      });
    })
    .catch((schemaError) => {
      if (process.env.NODE_ENV !== "test") {
        console.error(schemaError);
      }
      return res.status(500).json({
        message: "Payment schema init failed",
        error: schemaError.message,
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

    // Fire-and-forget bill generation + WhatsApp delivery.
    // Errors are logged but never block the checkout response.
    (async () => {
      try {
        const number = booking.mobile || booking.phone;
        if (!number) return;

        const invoice = await InvoiceModel.generateCustomerInvoice(req.params.id);
        const { generateInvoicePdf } = require("../utils/pdfGenerator");
        const { fileName } = await generateInvoicePdf(invoice);

        const publicBase = await getPublicBaseUrl(req);
        const fileUrl = `${publicBase}/uploads/invoices/${fileName}`;

        // Invoice template — has the PDF attached
        await sendTemplate({
          code: "invoice",
          autoFlag: "auto_send_invoice",
          number,
          fileUrl,
          fileName,
          vars: {
            guest_name: booking.guest_name || invoice.customerName || "Guest",
            room_no: booking.rooms || invoice.roomNumber || "—",
            invoice_no: invoice.invoiceNo || "",
            amount: Number(invoice.totalAmount || 0).toFixed(2),
            checkin_date: booking.check_in || "",
            checkout_date: booking.check_out || "",
          },
        });

        // Follow-up thank-you (text only, no PDF)
        await sendTemplate({
          code: "checkout_thanks",
          autoFlag: "auto_send_checkout_thanks",
          number,
          vars: {
            guest_name: booking.guest_name || invoice.customerName || "Guest",
            room_no: booking.rooms || invoice.roomNumber || "—",
          },
        });
      } catch (sendErr) {
        if (process.env.NODE_ENV !== "test") {
          console.error("Checkout WhatsApp send failed:", sendErr.message || sendErr);
        }
      }
    })();

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
