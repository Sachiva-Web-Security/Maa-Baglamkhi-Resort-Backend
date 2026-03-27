const db = require("../config/db");

const GuestModel = require("../models/guestModel");
const OtherBookingModel = require("../models/otherBookingModel");
const CompanyModel = require("../models/companyModel");
const PaxModel = require("../models/paxModel");
const AdvanceModel = require("../models/advanceModel");
const ReferenceModel = require("../models/referenceModel");
const RoomTariffModel = require("../models/roomTariffModel");
const Paymentadvance = require("../models/Paymentadvance");
const roomInventoryModel = require("../models/hotelRoomInventoryModel");

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
      return res.status(500).json({ message: "Guest creation failed" });
    }

    res.json({
      message: "Guest Created",
      bookingId: result.insertId,
      bookingCode: result.bookingCode,
    });
  });
};

exports.updateOtherBooking = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  OtherBookingModel.createOtherBooking(data, (err) => {
    if (err) {
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
        g.check_in,
        g.check_out,
        g.booking_status,
        c.company_name,
        COALESCE(SUM(rt.total), 0) AS totalAmount,
        IFNULL(a.amount, 0) AS paidAmount,
        IFNULL(a.discount_amount, 0) AS discountAmount,
        IFNULL(a.refund_amount, 0) AS refundAmount,
        (IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) AS netPaid,
        (
          SUM(rt.total) -
          ((IFNULL(a.amount, 0) - IFNULL(a.refund_amount, 0)) + IFNULL(a.discount_amount, 0))
        ) AS remainingAmount,
        GROUP_CONCAT(rt.room_number) AS rooms
      FROM guests g
      LEFT JOIN companies c ON g.id = c.booking_id
      LEFT JOIN advance_payment a ON g.id = a.booking_id
      LEFT JOIN room_tariff rt ON g.id = rt.booking_id
      WHERE LOWER(IFNULL(g.booking_status, 'confirmed')) NOT IN ('checked out', 'cancelled')
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
        a.refund_amount
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
    const summaryResult = await query(
      `
        SELECT
          g.id AS bookingId,
          g.booking_code AS bookingCode,
          g.booking_code,
          g.guest_name,
          g.mobile,
          g.guest_email,
          g.check_in,
          g.check_out,
          g.booking_status,
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

          return res.json({
            message: "Payment Added + History Saved",
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
        g.check_in,
        g.check_out,
        g.booking_status,
        c.company_name,
        COALESCE(SUM(rt.total), 0) AS totalAmount,
        IFNULL(a.amount, 0) AS paidAmount,
        IFNULL(a.discount_amount, 0) AS discountAmount,
        IFNULL(a.refund_amount, 0) AS refundAmount,
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
