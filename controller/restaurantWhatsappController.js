/**
 * WhatsApp Restaurant Invoice Controller
 *
 * Endpoint:
 *   POST /api/restaurant/invoice/send-whatsapp/:billId
 *
 * Generates a restaurant bill PDF → sends it to the customer AND admin
 * via WhatsApp + SMS using the existing `whatsappService.js`.
 */

const WhatsAppService = require("../services/whatsappService");
const RestaurantPdfService = require("../services/restaurantInvoicePdfService");

const getPublicBaseUrl = () => {
  const env =
    process.env.PUBLIC_BASE_URL ||
    process.env.PUBLIC_URL ||
    process.env.CLIENT_URL ||
    "";
  if (env) return env.replace(/\/+$/, "");
  return `http://localhost:${process.env.PORT || 5002}`;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatINR = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const round2 = (value) => Number((Number(value || 0)).toFixed(2));

/**
 * POST /api/restaurant/invoice/send-whatsapp/:billId
 *
 * Body (optional overrides):
 *   {
 *     "customerNumber": "9876543210",
 *     "customerMessage": "Your custom message",
 *     "adminNumber": "9876543210",
 *     "adminMessage": "Your custom admin message"
 *   }
 */
exports.sendRestaurantInvoiceWhatsApp = async (req, res) => {
  try {
    const billId = Number(req.params.billId);
    if (!billId || billId <= 0) {
      return res.status(400).json({ error: "Valid bill ID is required" });
    }

    // ── 1. Fetch bill row ──────────────────────────────────────────────────
    const BillModel = require("../models/RestaurantModel");
    await BillModel.ensureSchema();

    const bill = await new Promise((resolve, reject) => {
      BillModel.getBillById(billId, (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!bill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // ── 2. Fetch token items (if available) ────────────────────────────────
    let tokenItems = [];
    if (bill.tokenId) {
      try {
        const TokenModel = require("../models/TokenModel");
        tokenItems = await new Promise((resolve, reject) => {
          TokenModel.getTokenItems(bill.tokenId, (err, rows) => (err ? reject(err) : resolve(rows)));
        });
      } catch {
        // Token may have been deleted; continue without items
        tokenItems = [];
      }
    }

    // ── 3. Normalise items for PDF ─────────────────────────────────────────
    const normalisedItems = tokenItems.map((item) => ({
      name: item.item_name || item.name || "Menu Item",
      qty: Number(item.qty || 0),
      rate: Number(item.rate || 0),
      total: round2(Number(item.qty || 0) * Number(item.rate || 0)),
    }));

    // ── 4. Build invoice payload for PDF ───────────────────────────────────
    const invoiceForPdf = {
      id: bill.id,
      billId: bill.id,
      entityType: bill.entityType || "Table",
      tableNumber: bill.tableNumber,
      customerName: bill.customerName || "Walk-in Customer",
      phone: bill.phone || "",
      subtotal: round2(bill.subtotal || 0),
      serviceCharge: round2(bill.serviceCharge || 0),
      gst: round2(bill.gst || 0),
      discountAmount: round2(bill.discountAmount || 0),
      total: round2(bill.total || 0),
      paymentMethod: bill.paymentMethod || "Cash",
      invoiceStatus: bill.invoiceStatus || "Generated",
      created_at: bill.created_at,
      waiterName: bill.waiter_name || "",
      tokenId: bill.tokenId,
      tokenCode: bill.tokenCode || "",
      items: normalisedItems,
    };

    // ── 5. Generate PDF ────────────────────────────────────────────────────
    let pdfResult;
    try {
      pdfResult = await RestaurantPdfService.generateRestaurantInvoicePdf(invoiceForPdf);
    } catch (pdfErr) {
      console.error("Restaurant PDF generation failed:", pdfErr);
      return res.status(500).json({ error: "Failed to generate restaurant invoice PDF", details: pdfErr.message });
    }

    // ── 6. Build public file URL ───────────────────────────────────────────
    const publicBase = getPublicBaseUrl();
    const fileUrl = `${publicBase}/uploads/invoices/${pdfResult.fileName}`;

    // ── 7. Resolve admin number ────────────────────────────────────────────
    let adminNumber = req.body?.adminNumber || "";
    if (!adminNumber) {
      try {
        const UserModel = require("../models/UserModel");
        const adminRow = await new Promise((resolve, reject) => {
          UserModel.findAdminWithPhone((err, row) => (err ? reject(err) : resolve(row)));
        });
        adminNumber = adminRow?.phone || "";
      } catch {
        // continue without admin
      }
    }
    if (!adminNumber && process.env.ADMIN_WHATSAPP_NUMBER) {
      adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
    }

    // ── 8. Build messages ──────────────────────────────────────────────────
    const customerNumber = req.body?.customerNumber || bill.phone || "";
    const entityLabel =
      String(bill.entityType || "Table").toLowerCase() === "room" ? "Room" : "Table";
    const billDate = invoiceForPdf.created_at
      ? new Date(invoiceForPdf.created_at).toISOString().slice(0, 10)
      : "N/A";
    const subtotalFormatted = formatINR(invoiceForPdf.subtotal);
    const serviceChargeFormatted = formatINR(invoiceForPdf.serviceCharge || 0);
    const gstFormatted = formatINR(invoiceForPdf.gst);
    const discountFormatted = formatINR(invoiceForPdf.discountAmount);
    const totalFormatted = formatINR(invoiceForPdf.total);
    const itemCount = normalisedItems.length;
    const paymentStatus = invoiceForPdf.invoiceStatus || "Generated";
    const paymentMethod = invoiceForPdf.paymentMethod || "Cash";
    const isPaid = String(paymentStatus).toLowerCase() === "paid";
    const remainingAmount = isPaid ? 0 : round2(invoiceForPdf.total);

    const defaultCustomerMessage =
      `Dear ${invoiceForPdf.customerName},\n\n` +
      `Thank you for dining at Maa Baglamukhi Resort.\n\n` +
      `📋 RESTAURANT INVOICE #${pdfResult.invoiceNo}\n` +
      `─────────────────────────────\n` +
      `${entityLabel}: ${bill.tableNumber}\n` +
      `Visit ID: ${invoiceForPdf.tokenCode || invoiceForPdf.tokenId || "N/A"}\n` +
      `Date: ${billDate}\n` +
      `Payment Method: ${paymentMethod}\n` +
      `─────────────────────────────\n` +
      `Items Ordered: ${itemCount}\n` +
      `Food Total: ₹ ${subtotalFormatted}\n` +
      `GST: ₹ ${gstFormatted}\n` +
      `${invoiceForPdf.serviceCharge > 0 ? `Service Charge: ₹ ${serviceChargeFormatted}\n` : ""}` +
      `${invoiceForPdf.discountAmount > 0 ? `Discount: - ₹ ${discountFormatted}\n` : ""}` +
      `─────────────────────────────\n` +
      `Grand Total: ₹ ${totalFormatted}\n` +
      `─────────────────────────────\n` +
      `Payment Status: ${isPaid ? "✅ PAID" : "⏳ PENDING"}\n` +
      `${isPaid ? "" : `Remaining Amount: ₹ ${formatINR(remainingAmount)}\n`}` +
      `\nPlease find the invoice attached.\n\n` +
      `Regards,\nMaa Baglamukhi Resort`;

    const customerMessage = req.body?.customerMessage || defaultCustomerMessage;

    const defaultAdminMessage =
      `📋 New restaurant invoice — #${pdfResult.invoiceNo}\n` +
      `─────────────────────────────\n` +
      `${entityLabel}: ${bill.tableNumber}\n` +
      `Guest: ${invoiceForPdf.customerName}\n` +
      `Phone: ${customerNumber || "N/A"}\n` +
      `Visit ID: ${invoiceForPdf.tokenCode || invoiceForPdf.tokenId || "N/A"}\n` +
      `Date: ${billDate}\n` +
      `─────────────────────────────\n` +
      `Items: ${itemCount}\n` +
      `Food Total: ₹ ${subtotalFormatted}\n` +
      `GST: ₹ ${gstFormatted}\n` +
      `${invoiceForPdf.serviceCharge > 0 ? `Service Charge: ₹ ${serviceChargeFormatted}\n` : ""}` +
      `${invoiceForPdf.discountAmount > 0 ? `Discount: - ₹ ${discountFormatted}\n` : ""}` +
      `─────────────────────────────\n` +
      `Grand Total: ₹ ${totalFormatted}\n` +
      `Payment: ${paymentMethod}\n` +
      `Status: ${paymentStatus}`;

    const adminMessage = req.body?.adminMessage || defaultAdminMessage;

    // ── 9. Send via WhatsApp Service ───────────────────────────────────────
    const invoicePayload = {
      customerName: invoiceForPdf.customerName,
      phone: customerNumber,
      totalAmount: invoiceForPdf.total,
      invoiceNo: pdfResult.invoiceNo,
      paymentStatus: invoiceForPdf.invoiceStatus,
      paymentMethod: invoiceForPdf.paymentMethod,
    };

    const attachment = { fileUrl, fileName: pdfResult.fileName, filePath: pdfResult.filePath };

    let results = await WhatsAppService.sendInvoiceNotifications(
      invoicePayload,
      attachment,
      {
        customerNumber,
        adminNumber: adminNumber || undefined,
        customerMessage,
        adminMessage,
      },
    );

    // If WhatsApp delivery failed (likely due to PDF unreachable), retry text-only
    const whatsappFailed = (channel) =>
      channel?.whatsapp &&
      !channel.whatsapp.ok &&
      !channel.whatsapp.skipped;

    let sendMode = "pdf";
    if (whatsappFailed(results.customer) || whatsappFailed(results.admin)) {
      console.warn("[restaurant-whatsapp] WhatsApp PDF send failed, retrying text-only");
      sendMode = "text-only";
      results = await WhatsAppService.sendInvoiceNotifications(
        invoicePayload,
        null,
        {
          customerNumber,
          adminNumber: adminNumber || undefined,
          customerMessage,
          adminMessage,
        },
      );
    }

    // ── 10. Determine overall status ──────────────────────────────────────
    const customerWaOk =
      results?.customer?.whatsapp?.ok || results?.customer?.whatsapp?.skipped;
    const adminWaOk =
      !results?.admin?.whatsapp ||
      results?.admin?.whatsapp?.ok ||
      results?.admin?.whatsapp?.skipped;
    const allOk = customerWaOk && adminWaOk;

    const modeHint = sendMode === "text-only" ? " (text-only — PDF attachment could not be delivered)" : "";

    res.status(allOk ? 200 : 207).json({
      message: allOk
        ? `Restaurant invoice sent to customer and admin via WhatsApp${modeHint}`
        : `Restaurant invoice sent with some failures (check individual channel results)${modeHint}`,
      billId,
      invoiceNo: pdfResult.invoiceNo,
      sendMode,
      fileUrl: sendMode === "pdf" ? fileUrl : null,
      customer: {
        number: customerNumber || "",
        ...results?.customer,
      },
      admin: {
        number: adminNumber || "",
        ...results?.admin,
      },
    });
  } catch (error) {
    console.error("sendRestaurantInvoiceWhatsApp error:", error);
    res.status(500).json({ error: error.message || "Failed to send restaurant WhatsApp invoice" });
  }
};