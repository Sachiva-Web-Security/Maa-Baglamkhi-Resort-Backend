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
    // Fetch existing invoice to know whether WhatsApp should fire
    const invoiceRow = await new Promise((resolve, reject) => {
      Invoice.getInvoiceByBookingId(req.params.id, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });

    await Invoice.updatePaymentStatus(req.params.id, paymentStatus);

    // Auto-send WhatsApp invoice if payment is now Paid/Completed
    const normalized = String(paymentStatus || "").trim().toLowerCase();
    const shouldNotify = normalized === "paid" || normalized === "completed";

    if (shouldNotify && invoiceRow) {
      setImmediate(async () => {
        try {
          const { generateInvoicePdf } = require("../services/invoicePdfService");
          const WhatsApp = require("../services/whatsappService");
          const UserModel = require("../models/userModel");

          const invoice = await new Promise((resolve) => {
            Invoice.getInvoiceByBookingId(req.params.id, (err, row) => {
              if (err) return resolve(null);
              resolve(row || null);
            });
          });

          if (!invoice) return;

          // Try to generate PDF
          let fileUrl = null;
          let fileName = null;
          let filePath = null;
          try {
            const pdf = await generateInvoicePdf(invoice);
            const publicBase =
              (process.env.PUBLIC_BASE_URL ||
                process.env.PUBLIC_URL ||
                process.env.CLIENT_URL ||
                `http://localhost:${process.env.PORT || 5002}`
              ).replace(/\/+$/, "");
            fileUrl = `${publicBase}/uploads/invoices/${pdf.fileName}`;
            fileName = pdf.fileName;
            filePath = pdf.filePath;
          } catch (pdfErr) {
            // PDF generation failed; send text-only
            if (process.env.NODE_ENV !== "test") {
              console.warn(
                `[auto-whatsapp] PDF generation failed for invoice #${invoice.invoice_no || invoice.id}:`,
                pdfErr.message || pdfErr,
              );
            }
          }

          // Resolve admin's WhatsApp number
          let adminNumber = "";
          try {
            const adminRows = await new Promise((resolve, reject) => {
              UserModel.findAdminUser((err, rows) =>
                err ? reject(err) : resolve(rows),
              );
            });
            adminNumber = adminRows?.[0]?.phone || "";
          } catch (e) {
            // ignore — service will note no admin number
          }

          const attachment = fileUrl
            ? { fileUrl, fileName, filePath }
            : undefined;

          await WhatsApp.sendInvoiceNotifications(
            {
              customerName: invoice.customer_name || "Guest",
              phone: invoice.phone || "",
              totalAmount: Number(invoice.total_amount || 0),
              invoiceNo: invoice.invoice_no || `#${invoice.id}`,
              checkIn: invoice.check_in || "",
              checkOut: invoice.check_out || "",
              paymentStatus: String(invoice.payment_status || "").trim(),
            },
            attachment,
            { adminNumber },
          );

          if (process.env.NODE_ENV !== "test") {
            console.log(
              `[auto-whatsapp] invoice #${invoice.invoice_no || invoice.id} (status: ${paymentStatus}) delivered`,
            );
          }
        } catch (autoErr) {
          console.error(
            "[auto-whatsapp] auto-send failed for invoice #",
            req.params.id,
            autoErr.message || autoErr,
          );
        }
      });
    }

    res.json({ message: "Payment status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update payment status" });
  }
};