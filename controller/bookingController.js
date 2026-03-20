const db = require("../config/db");

const GuestModel = require("../models/guestModel");
const OtherBookingModel = require("../models/otherBookingModel");
const CompanyModel = require("../models/companyModel");
const PaxModel = require("../models/paxModel");
const AdvanceModel = require("../models/advanceModel");
const ReferenceModel = require("../models/referenceModel");
const RoomTariffModel = require("../models/roomTariffModel");
const Paymentadvance = require("../models/Paymentadvance");

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
// controller/bookingController.js

exports.updateCompany = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  console.log("📦 COMPANY DATA:", data); // debug

  CompanyModel.addCompany(data, (err, result) => {
    if (err) {
      console.error("❌ COMPANY ERROR:", err);

      return res.status(500).json({
        message: "Company save failed",
        error: err.message
      });
    }

    res.json({
      message: "Company Added ✅",
      id: result.insertId
    });
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
    LEFT JOIN companies c ON g.id = c.booking_id
    LEFT JOIN advance_payment a ON g.id = a.booking_id
    LEFT JOIN room_tariff rt ON g.id = rt.booking_id

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
      g.mobile,
      c.company_name,
      a.amount AS paidAmount,
      a.refund_amount AS refundAmount
    FROM guests g
    LEFT JOIN companies c ON g.id = c.booking_id
    LEFT JOIN advance_payment a ON g.id = a.booking_id
    WHERE g.id = ?
    LIMIT 1
  `;

  const roomsSql = `
    SELECT 
      rt.room_number,
      rt.tariff,
      rt.gst,
      rt.total,
      p.adults,
      p.children
    FROM room_tariff rt
    LEFT JOIN pax p 
      ON rt.booking_id = p.booking_id 
      AND rt.room_number = p.room_number
    WHERE rt.booking_id = ?
  `;

  db.query(summarySql, [id], (err1, summaryResult) => {
    if (err1) return res.status(500).json(err1);

    db.query(roomsSql, [id], (err2, roomsResult) => {
      if (err2) return res.status(500).json(err2);

      res.json({
        ...summaryResult[0],
        rooms: roomsResult,
      });
    });
  });
};
// ================= FULL BOOKING UPDATE =================
exports.updateFullBooking = (req, res) => {
  const id = req.params.id;
  const { guest_name, mobile, company_name, rooms, paidAmount } = req.body;

  db.query("UPDATE guests SET guest_name=?, mobile=? WHERE id=?", [
    guest_name,
    mobile,
    id,
  ]);

  db.query("UPDATE companies SET company_name=? WHERE booking_id=?", [
    company_name,
    id,
  ]);

  db.query("UPDATE advance_payment SET amount=? WHERE booking_id=?", [
    paidAmount,
    id,
  ]);

  // 🔥 MULTIPLE ROOMS UPDATE
  for (const room of rooms) {
    db.query(
      `UPDATE room_tariff 
       SET tariff=?, gst=?, total=? 
       WHERE booking_id=? AND room_number=?`,
      [room.tariff, room.gst, room.total, id, room.room_number]
    );

    db.query(
      `UPDATE pax 
       SET adults=?, children=? 
       WHERE booking_id=? AND room_number=?`,
      [room.adults, room.children, id, room.room_number]
    );
  }

  res.json({ message: "Full Booking Updated ✅" });
};
// ================= DELETE =================
exports.deleteBooking = (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM guests WHERE id=?", [id]);
  db.query("DELETE FROM companies WHERE booking_id=?", [id]);
  db.query("DELETE FROM pax WHERE booking_id=?", [id]);
  db.query("DELETE FROM room_tariff WHERE booking_id=?", [id]);
  db.query("DELETE FROM advance_payment WHERE booking_id=?", [id]);

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
   WHERE booking_id=? 
    `,
    [amount, id],
    (err) => {
      if (err) return res.status(500).json(err);

      res.json({ message: "Refund Done" });
    }
  );
};





exports.updateAdvance = (req, res) => {
  const data = { booking_id: req.params.id, ...req.body };

  // 1️⃣ Save payment history
  Paymentadvance.addPayment(data, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Payment history failed" });
    }

    // 2️⃣ Update advance total
    AdvanceModel.addAdvance(data, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Advance save failed" });
      }

      res.json({
        message: "Payment Added + History Saved ✅"
      });
    });
  });
};



// ================= PAYMENT HISTORY =================
exports.getPaymentHistory = (req, res) => {
  const bookingId = req.params.id;

  const sql = `
    SELECT 
      ph.id,
      ph.amount,
      ph.payment_mode,
      ph.created_at,

      g.guest_name,

      GROUP_CONCAT(DISTINCT rt.room_number ORDER BY rt.room_number) AS rooms

    FROM payment_history ph

    LEFT JOIN guests g 
      ON ph.booking_id = g.id

    LEFT JOIN room_tariff rt 
      ON ph.booking_id = rt.booking_id

    WHERE ph.booking_id = ?

    GROUP BY 
      ph.id, ph.amount, ph.payment_mode, ph.created_at, g.guest_name

    ORDER BY ph.id DESC
  `;

  db.query(sql, [bookingId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }
    res.json(result);
  });
};