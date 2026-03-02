const db = require("../config/db");

const createInvoice = (data, callback) => {
  const sql = `
    INSERT INTO invoices 
    (invoice_no, date, customer_name, phone, room_no, check_in, check_out,
     price_per_day, food_charge, extra_charge, gst, discount,
     final_total, payment_mode, status, notes, booking_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      data.invoiceNo,
      data.date,
      data.customerName,
      data.phone,
      data.roomNo,
      data.checkIn,
      data.checkOut,
      data.pricePerDay,
      data.foodCharge,
      data.extraCharge,
      data.gst,
      data.discount,
      data.finalTotal,
      data.paymentMode,
      data.status,
      data.notes,
      data.bookingId || null,
    ],
    callback
  );
};

const getAllInvoices = (callback) => {
  const sql = "SELECT * FROM invoices ORDER BY id DESC";
  db.query(sql, callback);
};

const getInvoiceByBookingId = (bookingId, callback) => {
  const sql = "SELECT * FROM invoices WHERE booking_id = ? ORDER BY id DESC LIMIT 1";
  db.query(sql, [bookingId], callback);
};

const updateInvoice = (id, data, callback) => {
  const sql = `
    UPDATE invoices SET
      date = ?, customer_name = ?, phone = ?, room_no = ?,
      check_in = ?, check_out = ?, price_per_day = ?,
      food_charge = ?, extra_charge = ?, gst = ?, discount = ?,
      final_total = ?, payment_mode = ?, status = ?, notes = ?
    WHERE id = ?
  `;
  db.query(
    sql,
    [
      data.date,
      data.customerName,
      data.phone,
      data.roomNo,
      data.checkIn,
      data.checkOut,
      data.pricePerDay,
      data.foodCharge,
      data.extraCharge,
      data.gst,
      data.discount,
      data.finalTotal,
      data.paymentMode,
      data.status,
      data.notes,
      id,
    ],
    callback
  );
};

module.exports = { createInvoice, getAllInvoices, getInvoiceByBookingId, updateInvoice };