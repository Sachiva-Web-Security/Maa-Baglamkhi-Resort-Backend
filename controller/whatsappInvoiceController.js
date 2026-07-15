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
const UserModel = require("../models/userModel");

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

    // 3a. Resolve admin number: request body → DB lookup (prefer admin WITH phone) → empty
    let adminNumber = req.body?.adminNumber || "";
    if (!adminNumber) {
      try {
        const adminRow = await new Promise((resolve, reject) => {
          UserModel.findAdminWithPhone((err, row) => (err ? reject(err) : resolve(row)));
        });
        adminNumber = adminRow?.phone || "";
        if (adminNumber) {
          console.log(`[send-whatsapp] Resolved admin number from DB: +${adminNumber} (admin id: ${adminRow?.id})`);
        } else {
          console.warn("[send-whatsapp] No admin user has a phone number set in the database");
        }
      } catch (err) {
        console.error("[send-whatsapp] DB lookup for admin phone failed:", err.message);
      }
    } else {
      console.log(`[send-whatsapp] Using admin number from request body: +${adminNumber}`);
    }

    // 4. Use the high-level helper to send to customer + admin (WhatsApp + SMS)
    const { customer, admin } = await WhatsAppService.sendInvoiceNotifications(
      invoice,
      { fileUrl, fileName: pdfResult.fileName },
      {
        customerNumber: req.body?.customerNumber,
        adminNumber,
        customerMessage: req.body?.customerMessage,
        adminMessage: req.body?.adminMessage,
      },
    );

    // New shape: {customer:{whatsapp, sms}, admin:{whatsapp, sms}}
    const customerWaOk = customer?.whatsapp?.ok || customer?.whatsapp?.skipped;
    const customerSmsOk = customer?.sms?.ok || customer?.sms?.skipped;
    const adminWaOk = !admin?.whatsapp || admin.whatsapp.ok || admin.whatsapp.skipped;
    const adminSmsOk = !admin?.sms || admin.sms.ok || admin.sms.skipped;

    const allOk =
      customerWaOk && customerSmsOk && adminWaOk && adminSmsOk;

    const statusCode = allOk ? 200 : 207;

    res.status(statusCode).json({
      message: allOk
        ? "Invoice sent to customer and admin via WhatsApp + SMS"
        : "Invoice sent with some failures (check individual channel results)",
      bookingId,
      invoiceNo: invoice.invoiceNo,
      customer: {
        number: WhatsAppService.normalizePhoneNumber(invoice.phone),
        whatsapp: customer?.whatsapp,
        sms: customer?.sms,
      },
      admin: {
        number: adminNumber || "",
        whatsapp: admin?.whatsapp,
        sms: admin?.sms,
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