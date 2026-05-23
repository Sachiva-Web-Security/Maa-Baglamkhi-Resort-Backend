const Invoice = require("../models/InvoiceModel");
const { sendTemplate, getPublicBaseUrl } = require("../utils/whatsappNotify");

exports.createInvoice = (req, res) => {
  Invoice.createInvoice(req.body, (err, result) => {
    if (err) {
      return res.status(500).json({ error: "Failed to create invoice", details: err.message || err });
    }

    // Fire-and-forget: generate PDF + send via WhatsApp.
    // Errors are logged but never block the invoice response.
    (async () => {
      try {
        const body = req.body || {};
        const number = body.phone || body.mobile;
        if (!number) return;

        // Build an invoice object compatible with utils/pdfGenerator
        const invoiceForPdf = {
          id: result.insertId,
          invoiceNo: body.invoiceNo || body.invoice_no || `INV-${result.insertId}`,
          date: body.date || new Date().toISOString().slice(0, 10),
          customerName: body.customerName || body.customer_name || "Guest",
          phone: number,
          roomNumber: body.roomNo || body.room_no || "—",
          items: [
            {
              name: `Room Charge (${body.days || 1} day${Number(body.days) === 1 ? "" : "s"})`,
              quantity: Number(body.days || 1),
              price: Number(body.pricePerDay || body.price_per_day || 0),
              total: Number(body.roomCharge || 0),
            },
            ...(Number(body.foodCharge || 0) > 0
              ? [{ name: "Food Charge", quantity: 1, price: Number(body.foodCharge), total: Number(body.foodCharge) }]
              : []),
            ...(Number(body.extraCharge || 0) > 0
              ? [{ name: "Extra Charge", quantity: 1, price: Number(body.extraCharge), total: Number(body.extraCharge) }]
              : []),
          ],
          subtotal: Number(body.subtotal || 0),
          tax: Number(body.gstAmount || 0),
          discount: Number(body.discount || 0),
          totalAmount: Number(body.finalTotal || 0),
        };

        const { generateInvoicePdf } = require("../utils/pdfGenerator");
        const { fileName } = await generateInvoicePdf(invoiceForPdf);

        const publicBase = await getPublicBaseUrl(req);
        const fileUrl = `${publicBase}/uploads/invoices/${fileName}`;

        await sendTemplate({
          code: "invoice",
          autoFlag: "auto_send_invoice",
          number,
          fileUrl,
          fileName,
          vars: {
            guest_name: invoiceForPdf.customerName,
            room_no: invoiceForPdf.roomNumber,
            invoice_no: invoiceForPdf.invoiceNo,
            amount: invoiceForPdf.totalAmount.toFixed(2),
            checkin_date: body.checkIn || body.check_in || "",
            checkout_date: body.checkOut || body.check_out || "",
          },
        });
      } catch (sendErr) {
        if (process.env.NODE_ENV !== "test") {
          console.error("Invoice WhatsApp send failed:", sendErr.message || sendErr);
        }
      }
    })();

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

    // Re-send updated invoice PDF via WhatsApp (fire-and-forget).
    (async () => {
      try {
        const body = req.body || {};
        const number = body.phone || body.mobile;
        if (!number) return;

        const invoiceForPdf = {
          id: req.params.id,
          invoiceNo: body.invoiceNo || body.invoice_no || `INV-${req.params.id}`,
          date: body.date || new Date().toISOString().slice(0, 10),
          customerName: body.customerName || body.customer_name || "Guest",
          phone: number,
          roomNumber: body.roomNo || body.room_no || "—",
          items: [
            {
              name: `Room Charge (${body.days || 1} day${Number(body.days) === 1 ? "" : "s"})`,
              quantity: Number(body.days || 1),
              price: Number(body.pricePerDay || 0),
              total: Number(body.roomCharge || 0),
            },
            ...(Number(body.foodCharge || 0) > 0
              ? [{ name: "Food Charge", quantity: 1, price: Number(body.foodCharge), total: Number(body.foodCharge) }]
              : []),
            ...(Number(body.extraCharge || 0) > 0
              ? [{ name: "Extra Charge", quantity: 1, price: Number(body.extraCharge), total: Number(body.extraCharge) }]
              : []),
          ],
          subtotal: Number(body.subtotal || 0),
          tax: Number(body.gstAmount || 0),
          discount: Number(body.discount || 0),
          totalAmount: Number(body.finalTotal || 0),
        };

        const { generateInvoicePdf } = require("../utils/pdfGenerator");
        const { fileName } = await generateInvoicePdf(invoiceForPdf);
        const publicBase = await getPublicBaseUrl(req);
        const fileUrl = `${publicBase}/uploads/invoices/${fileName}`;

        await sendTemplate({
          code: "invoice",
          autoFlag: "auto_send_invoice",
          number,
          fileUrl,
          fileName,
          vars: {
            guest_name: invoiceForPdf.customerName,
            room_no: invoiceForPdf.roomNumber,
            invoice_no: invoiceForPdf.invoiceNo,
            amount: invoiceForPdf.totalAmount.toFixed(2),
            checkin_date: body.checkIn || "",
            checkout_date: body.checkOut || "",
          },
        });
      } catch (sendErr) {
        if (process.env.NODE_ENV !== "test") {
          console.error("Invoice update WhatsApp send failed:", sendErr.message || sendErr);
        }
      }
    })();

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
