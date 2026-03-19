const db = require("../config/db");

const GuestModel = require("../models/guestModel");
const OtherBookingModel = require("../models/otherBookingModel");
const CompanyModel = require("../models/companyModel");
const PaxModel = require("../models/paxModel");
const AdvanceModel = require("../models/advanceModel");
const ReferenceModel = require("../models/referenceModel");
const RoomTariffModel = require("../models/roomTariffModel");


// ================= CREATE GUEST =================
exports.createGuest = (req, res) => {
  GuestModel.createGuest(req.body, (err, result) => {
    if (err) return res.status(500).json({ message: "Guest creation failed" });

    res.json({
      message: "Guest Created",
      bookingId: result.insertId
    });
  });
};


// ================= OTHER BOOKING =================
exports.updateOtherBooking = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  OtherBookingModel.createOtherBooking(data, (err) => {
    if (err) return res.status(500).json({ message: "Other booking failed" });

    res.json({ message: "Other Booking Saved" });
  });
};


// ================= REFERENCE =================
exports.updateReference = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  ReferenceModel.createReference(data, (err) => {
    if (err) return res.status(500).json({ message: "Reference save failed" });

    res.json({ message: "Reference Saved" });
  });
};


// ================= COMPANY =================
exports.updateCompany = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  CompanyModel.addCompany(data, (err) => {
    if (err) return res.status(500).json({ message: "Company save failed" });

    res.json({ message: "Company Added" });
  });
};


// ================= PAX =================
exports.updatePax = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  PaxModel.addPax(data, (err) => {
    if (err) return res.status(500).json({ message: "Pax save failed" });

    res.json({ message: "Pax Added" });
  });
};


// ================= ROOM TARIFF =================
exports.updateTariff = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  RoomTariffModel.addTariff(data, (err) => {
    if (err) return res.status(500).json({ message: "Tariff save failed" });

    res.json({ message: "Tariff Added" });
  });
};


// ================= ADVANCE =================
exports.updateAdvance = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  AdvanceModel.addAdvance(data, (err) => {
    if (err) return res.status(500).json({ message: "Advance save failed" });

    res.json({ message: "Advance Added" });
  });
};


// ================= ALL BOOKINGS (🔥 FINAL) =================
exports.getAllBookings = (req, res) => {
  const sql = `
    SELECT 
      g.id AS bookingId,
      g.guest_name,
      g.mobile,
      g.check_in,
      g.check_out,

      c.company_name,

      SUM(rt.total) AS totalAmount,

      a.amount AS paidAmount,
      a.refund_amount AS refundAmount,

      (a.amount - IFNULL(a.refund_amount,0)) AS netPaid,

      (SUM(rt.total) - (a.amount - IFNULL(a.refund_amount,0))) AS remainingAmount,

      GROUP_CONCAT(rt.room_number) AS rooms

    FROM guests g
    LEFT JOIN companies c ON g.id = c.guest_id
    LEFT JOIN advance_payment a ON g.id = a.guest_id
    LEFT JOIN room_tariff rt ON g.id = rt.guest_id

    GROUP BY g.id
    ORDER BY g.id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }
    res.json(result);
  });
};


// ================= GET SINGLE =================
exports.getBookingById = (req, res) => {
  db.query(
    "SELECT * FROM guests WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result[0]);
    }
  );
};


// ================= UPDATE BASIC =================
exports.updateBooking = (req, res) => {
  const { guest_name, mobile } = req.body;

  db.query(
    "UPDATE guests SET guest_name=?, mobile=? WHERE id=?",
    [guest_name, mobile, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Updated Successfully" });
    }
  );
};


// ================= FULL BOOKING GET =================
exports.getFullBooking = (req, res) => {
  const id = req.params.id;

  const summarySql = `
    SELECT 
      g.id AS bookingId,
      g.guest_name,
      g.guest_email,
      g.mobile,
      g.check_in,
      g.check_out,
      g.arrival,
      g.departure,
      g.booking_status,
      c.company_name,
      p.adults,
      p.children,
      p.meal_plan,
      a.amount AS paidAmount,
      a.payment_mode,
      a.remarks,
      a.transaction_details,
      a.receipt_account,
      a.refund_amount AS refundAmount
    FROM guests g
    LEFT JOIN companies c ON g.id = c.guest_id
    LEFT JOIN pax p ON g.id = p.guest_id
    LEFT JOIN advance_payment a ON g.id = a.guest_id
    WHERE g.id = ?
    LIMIT 1
  `;

  const roomsSql = `
    SELECT
      room_number,
      quantity,
      tariff,
      gst,
      total,
      date
    FROM room_tariff
    WHERE guest_id = ?
    ORDER BY id ASC
  `;

  db.query(summarySql, [id], (summaryErr, summaryResult) => {
    if (summaryErr) {
      return res.status(500).json(summaryErr);
    }

    db.query(roomsSql, [id], (roomsErr, roomsResult) => {
      if (roomsErr) {
        return res.status(500).json(roomsErr);
      }

      const summary = summaryResult[0] || {};
      const rooms = Array.isArray(roomsResult) ? roomsResult : [];
      const totalAmount = rooms.reduce(
        (sum, room) => sum + Number(room.total || 0),
        0,
      );
      const paidAmount = Number(summary.paidAmount || 0);
      const refundAmount = Number(summary.refundAmount || 0);
      const remainingAmount = totalAmount - (paidAmount - refundAmount);

      res.json({
        ...summary,
        rooms,
        totalAmount,
        paidAmount,
        refundAmount,
        remainingAmount,
      });
    });
  });
};


// ================= FULL BOOKING UPDATE =================
exports.updateFullBooking = (req, res) => {
  const id = req.params.id;

  const {
    guest_name,
    mobile,
    company_name,
    adults,
    children,
    room_number,
    tariff,
    gst,
    total,
    paidAmount
  } = req.body;

  db.query("UPDATE guests SET guest_name=?, mobile=? WHERE id=?", [guest_name, mobile, id]);
  db.query("UPDATE companies SET company_name=? WHERE guest_id=?", [company_name, id]);
  db.query("UPDATE pax SET adults=?, children=? WHERE booking_id=?", [adults, children, id]);

  db.query(`
    UPDATE room_tariff 
    SET room_number=?, tariff=?, gst_percent=?, total=? 
    WHERE guest_id=?`,
    [room_number, tariff, gst, total, id]
  );

  db.query("UPDATE advance_payment SET amount=? WHERE guest_id=?", [paidAmount, id]);

  res.json({ message: "Full Booking Updated ✅" });
};


// ================= DELETE =================
exports.deleteBooking = (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM guests WHERE id=?", [id]);
  db.query("DELETE FROM companies WHERE guest_id=?", [id]);
  db.query("DELETE FROM pax WHERE booking_id=?", [id]);
  db.query("DELETE FROM room_tariff WHERE guest_id=?", [id]);
  db.query("DELETE FROM advance_payment WHERE guest_id=?", [id]);

  res.json({ message: "Booking Deleted" });
};


// ================= REFUND =================
exports.refundBooking = (req, res) => {
  const id = req.params.id;
  const { amount } = req.body;

  db.query(
    `
    UPDATE advance_payment 
    SET refund_amount = IFNULL(refund_amount,0) + ?
    WHERE guest_id=?
    `,
    [amount, id],
    (err) => {
      if (err) return res.status(500).json(err);

      res.json({ message: "Refund Done" });
    }
  );
};
