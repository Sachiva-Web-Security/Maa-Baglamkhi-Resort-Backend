const Invoice = require("../models/InvoiceModel");

exports.createInvoice = (req, res) => {
  Invoice.createInvoice(req.body, (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to create invoice", details: err.message || err });
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
      return res.status(500).json({ error: "Failed to fetch invoices", details: err.message || err });
    }
    res.json(results || []);
  });
};

exports.getInvoiceByBookingId = (req, res) => {
  Invoice.getInvoiceByBookingId(req.params.bookingId, (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch invoice", details: err.message || err });
    }
    res.json(result || {});
  });
};

exports.updateInvoice = (req, res) => {
  Invoice.updateInvoice(req.params.id, req.body, (err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to update invoice", details: err.message || err });
    }
    res.json({ message: "Invoice updated successfully" });
  });
};

exports.generateCustomerInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.generateCustomerInvoice(req.params.customerId);
    res.json(invoice);
  } catch (error) {
    const status = String(error.message || "").includes("not found") ? 404 : 500;
    res.status(status).json({ error: error.message || "Failed to generate invoice" });
  }
};

exports.updateInvoicePaymentStatus = async (req, res) => {
  const paymentStatus = String(req.body.paymentStatus || "").trim();
  if (!paymentStatus) {
    return res.status(400).json({ error: "paymentStatus is required" });
  }

  try {
    await Invoice.updatePaymentStatus(req.params.id, paymentStatus);
    res.json({ message: "Payment status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update payment status" });
  }
};
