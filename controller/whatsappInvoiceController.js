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
const UserModel = require("../models/UserModel");
const db = require("../config/db");

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

const round2 = (value) => Number((Number(value || 0)).toFixed(2));

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

    // 1. Fetch or generate the invoice — reuse existing if available
    let invoice;
    try {
      const existing = await Invoice.getInvoiceByBookingId(bookingId);
      if (existing) {
        invoice = existing;
      }
    } catch { /* not found, will generate below */ }

    if (!invoice) {
      invoice = await Invoice.generateCustomerInvoice(bookingId);
    }
    if (!invoice) {
      return res.status(404).json({ error: "Booking or invoice not found" });
    }

    // 1b. Fetch advance payment info to calculate remaining amount correctly
    let advanceAmount = 0;
    let advanceDiscount = 0;
    try {
      const advanceRows = await new Promise((resolve, reject) => {
        db.query("SELECT amount, discount_amount FROM advance_payment WHERE booking_id = ? LIMIT 1", [bookingId], (err, rows) => (err ? reject(err) : resolve(rows)));
      });
      if (advanceRows.length) {
        advanceAmount = Number(advanceRows[0].amount || 0);
        advanceDiscount = Number(advanceRows[0].discount_amount || 0);
      }
    } catch {
      // advance_payment table may not exist; continue without advance info
    }

    // 1c. Fetch folio totals for accurate remaining calculation
    let folioPayments = 0;
    let folioDiscounts = 0;
    try {
      const FolioModel = require("../models/folioModel");
      const folioTotals = await FolioModel.getFolioTotals(bookingId);
      folioPayments = Number(folioTotals.payments || 0);
      folioDiscounts = Number(folioTotals.discounts || 0);
    } catch {
      // folio table may not exist; continue
    }

    // Remaining = total amount - (advance paid + folio payments + advance discount + folio discount)
    const totalPaid = advanceAmount + folioPayments + advanceDiscount + folioDiscounts;
    const remainingAmount = round2(Number(invoice.totalAmount || 0) - totalPaid);
    const isPaid = remainingAmount <= 0;
    const paymentStatus = isPaid ? "Paid" : "Pending";
    const paymentMethod = invoice.paymentMode || "Cash";

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
    // 3a. Resolve admin number: request body → DB lookup (prefer admin WITH phone) → env fallback → empty
    let adminNumber = req.body?.adminNumber || "";
    console.log("[send-whatsapp] adminNumber from request body:", adminNumber || "(empty)");
    if (!adminNumber) {
      try {
        const adminRow = await new Promise((resolve, reject) => {
          UserModel.findAdminWithPhone((err, row) => (err ? reject(err) : resolve(row)));
        });
        adminNumber = adminRow?.phone || "";
        console.log("[send-whatsapp] adminNumber from DB:", adminNumber || "(empty — no admin has phone set)", "adminId:", adminRow?.id || "null");
      } catch (err) {
        console.error("[send-whatsapp] DB lookup for admin phone failed:", err.message);
      }
    } else {
      console.log("[send-whatsapp] Using admin number from request body:", adminNumber);
    }

    // Last-resort fallback: env-defined ADMIN_WHATSAPP_NUMBER so the admin
    // still receives the invoice even if no one has filled Profile yet.
    if (!adminNumber && process.env.ADMIN_WHATSAPP_NUMBER) {
      adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
      console.log("[send-whatsapp] using ADMIN_WHATSAPP_NUMBER from env:", adminNumber);
    }
    console.log("[send-whatsapp] Final adminNumber passed to service:", adminNumber || "(empty)");

    // 4. Use the high-level helper to send to customer + admin (WhatsApp + SMS)
    //
    // 🐛 FIX: previously only { fileUrl, fileName } was passed here — the
    // actual local disk path (pdfResult.filePath) was dropped. whatsappService's
    // sendWhatsAppMessage() only attempts the real multipart PDF upload when
    // `attachment.filePath` exists and points to a real file on disk
    // (`if (filePath && fs.existsSync(filePath))`); without it, that check
    // always fails and the code silently falls through to a TEXT-ONLY
    // fallback message ("Your invoice PDF is available. Please contact the
    // resort for a copy.") — which is exactly why the customer never
    // received the actual invoice PDF. Passing filePath through fixes it.
    const { customer, admin } = await WhatsAppService.sendInvoiceNotifications(
      invoice,
      { fileUrl, fileName: pdfResult.fileName, filePath: pdfResult.filePath },
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