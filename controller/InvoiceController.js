const Invoice = require("../models/InvoiceModel");

exports.createInvoice = (req, res) => {
  Invoice.createInvoice(req.body, (err, result) => {
    if (err) {
      console.log("❌ DB ERROR while creating invoice:", err);
      return res.status(500).json({ error: "Failed to create invoice", details: err });
    }
    res.json({
      message: "Invoice created successfully",
      id: result.insertId,
    });
  });
};

exports.getAllInvoices = (req, res) => {
  Invoice.getAllInvoices((err, results) => {
    if (err) {
      console.log("❌ DB ERROR while fetching invoices:", err);
      return res.status(500).json({ error: "Failed to fetch invoices", details: err });
    }
    res.json(results);
  });
};

exports.getInvoiceByBookingId = (req, res) => {
  const bookingId = req.params.bookingId;
  Invoice.getInvoiceByBookingId(bookingId, (err, results) => {
    if (err) {
      console.log("❌ DB ERROR while fetching invoice by booking ID:", err);
      return res.status(500).json({ error: "Failed to fetch invoice", details: err });
    }
    res.json(results);
  });
};

exports.updateInvoice = (req, res) => {
  const id = req.params.id;
  Invoice.updateInvoice(id, req.body, (err, result) => {
    if (err) {
      console.log("❌ DB ERROR while updating invoice:", err);
      return res.status(500).json({ error: "Failed to update invoice", details: err });
    }
    res.json({
      message: "Invoice updated successfully",
    });
  });
};