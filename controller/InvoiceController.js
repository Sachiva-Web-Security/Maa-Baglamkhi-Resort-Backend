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

    // Generate PDF
    const { generateInvoicePdf } = require('../utils/pdfGenerator');
    const path = require('path');
    const publicBase = String(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`)
      .trim()
      .replace(/\/$/, '');

    try {
      const { filePath, fileName } = await generateInvoicePdf(invoice);
      // Build accessible file URL
      const uploadsRel = `/uploads/invoices/${fileName}`;
      const fileUrl = publicBase + uploadsRel;

      // Call WASend to send PDF via WhatsApp (GET with query params)
      const fetch = global.fetch || require('undici').fetch;
      const number = String(invoice.phone || '').replace(/[^0-9]/g, '');

      if (number && process.env.WASEND_USERNAME && process.env.WASEND_TOKEN) {
        try {
          const wasendUrl = new URL('https://wasend.sachiva.cloud/api/send-message');
          wasendUrl.searchParams.set('username', process.env.WASEND_USERNAME);
          wasendUrl.searchParams.set('token', process.env.WASEND_TOKEN);
          wasendUrl.searchParams.set('number', number);
          wasendUrl.searchParams.set('message', `Your invoice ${invoice.invoiceNo || ''}`);
          wasendUrl.searchParams.set('file_url', fileUrl);
          wasendUrl.searchParams.set('file_name', fileName);

          const resp = await fetch(wasendUrl.toString());
          const sendResult = await resp.json().catch(() => null);
          invoice.pdf = { fileUrl, filePath };
          invoice.wasend = sendResult || { status: 'unknown' };
        } catch (sendErr) {
          invoice.pdf = { fileUrl, filePath };
          invoice.wasend = { status: 'error', error: sendErr.message || String(sendErr) };
        }
      } else {
        invoice.pdf = { fileUrl, filePath };
        invoice.wasend = { status: 'skipped', reason: !number ? 'No phone number' : 'WASend credentials missing' };
      }
    } catch (pdfErr) {
      invoice.pdf = { error: pdfErr.message || String(pdfErr) };
    }

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
