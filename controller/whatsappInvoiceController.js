/**
 * WhatsApp Invoice Controller
 *
 * Endpoints:
 *   POST /api/hotel/invoice/send-whatsapp/:bookingId
 *     Generates invoice PDF → sends it to customer AND admin via WhatsApp
 *
 * The admin's WhatsApp number is read from the `app_settings` table at
 * runtime (admin editable from the UI). The customer's number is read from
 * the booking's `mobile` field, which can also be edited by an admin.
 */

const Invoice = require("../models/InvoiceModel");
const WhatsAppService = require("../services/whatsappService");
const InvoicePdfService = require("../services/invoicePdfService");

/**
 * Resolve the public base URL for serving invoice PDFs.
 */
const getPublicBaseUrl = () => {
  const env =
    process.env.PUBLIC_BASE_URL ||
    process.env.PUBLIC_URL ||
    process.env.CLIENT_URL ||
    "";

  if (env) {
    return env.replace(/\/+$/, "");
  }

  const port = process.env.PORT || 5002;
  return `http://localhost:${port}`;
};

/**
 * POST /api/hotel/invoice/send-whatsapp/:bookingId
 *
 * Body (optional overrides):
 *   {
 *     "customerNumber": "9876543210",
 *     "customerMessage": "Your custom message",
 *     "adminNumber": "9876543210",
 *     "adminMessage": "Your custom admin message",
 *     "deviceToken": "..."
 *   }
 */
exports.sendInvoiceWhatsApp = async (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    if (!bookingId) {
      return res.status(400).json({ error: "Valid booking ID is required" });
    }

    // 1. Generate the invoice
    const invoice = await Invoice.generateCustomerInvoice(bookingId);
    if (!invoice) {
      return res.status(404).json({ error: "Booking or invoice not found" });
    }

    // 2. Generate the PDF
    let pdfResult;
    try {
      pdfResult = await InvoicePdfService.generateInvoicePdf(invoice);
    } catch (pdfErr) {
      console.error("Invoice PDF generation failed:", pdfErr);
      return res
        .status(500)
        .json({ error: "Failed to generate invoice PDF", details: pdfErr.message });
    }

    // 3. Build the public file URL
    const publicBase = getPublicBaseUrl();
    const fileUrl = `${publicBase}/uploads/invoices/${pdfResult.fileName}`;

    // 4. Use the high-level helper to send to customer + admin
    const { customer, admin } = await WhatsAppService.sendInvoiceNotifications(
      invoice,
      { fileUrl, fileName: pdfResult.fileName },
      {
        customerNumber: req.body?.customerNumber,
        adminNumber: req.body?.adminNumber,
        customerMessage: req.body?.customerMessage,
        adminMessage: req.body?.adminMessage,
      },
    );

    const allOk =
      customer && customer.ok &&
      (!admin || admin.ok || admin.skipped);

    const statusCode = allOk ? 200 : 207;

    res.status(statusCode).json({
      message: allOk
        ? "Invoice WhatsApp message sent successfully"
        : "Invoice WhatsApp message sent with some failures",
      bookingId,
      invoiceNo: invoice.invoiceNo,
      customer: {
        number: WhatsAppService.normalizePhoneNumber(invoice.phone),
        result: customer,
      },
      admin: {
        number: WhatsAppService.normalizePhoneNumber(admin.number || ""),
        result: admin,
      },
      fileUrl,
    });
  } catch (error) {
    console.error("sendInvoiceWhatsApp error:", error);
    res
      .status(500)
      .json({ error: error.message || "Failed to send WhatsApp invoice" });
  }
};