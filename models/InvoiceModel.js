const db = require("../config/db");

const createInvoice = (data, callback) => {
  const sql = `
    INSERT INTO invoices 
    (invoice_no, date, customer_name, phone, room_no, check_in, check_out,
     price_per_day, food_charge, extra_charge, gst, discount,
     final_total, payment_mode, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.notes
    ],
    callback
  );
};

const getAllInvoices = (callback) => {
  const sql = "SELECT * FROM invoices ORDER BY id DESC";
  db.query(sql, callback);
};

module.exports = { createInvoice, getAllInvoices };