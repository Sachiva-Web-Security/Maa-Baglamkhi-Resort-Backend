/**
 * Banquet Invoice PDF Service
 *
 * Generates a professional A4 invoice PDF for banquet bookings and saves it
 * under <UPLOADS_DIR>/invoices/ so it can be served via /uploads/invoices/.
 */

const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

// Resolve to the project's /uploads/invoices directory
const OUTPUT_DIR =
  process.env.INVOICE_UPLOAD_DIR ||
  path.resolve(__dirname, "..", "uploads", "invoices");

/**
 * Ensure the output directory exists.
 */
const ensureOutputDir = () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
};

const INR = "₹";

/**
 * Format a plain number as Indian-format currency.
 *   1234.50 -> "1,234.50"
 */
const formatINR = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const round2 = (value) => Number((Number(value || 0)).toFixed(2));

/**
 * Generate a banquet invoice PDF and save it to disk.
 *
 * @param {object} booking
 *   @property {string|number} bookingId
 *   @property {string} invoiceNo
 *   @property {string} customerName
 *   @property {string} phone
 *   @property {string} guestEmail
 *   @property {string} eventTitle
 *   @property {string} eventType
 *   @property {number} guests
 *   @property {string} date        "YYYY-MM-DD"
 *   @property {string} startTime   "HH:MM"
 *   @property {string} endTime     "HH:MM"
 *   @property {string} hallName
 *   @property {string} menuPackageId
 *   @property {string} mealSection
 *   @property {string} customMenuItems
 *   @property {string} lightingSystem
 *   @property {string} paymentMode
 *   @property {string} paymentStatus
 *   @property {number} hallCharge
 *   @property {number} mealCharge
 *   @property {number} customMenuCharge
 *   @property {number} lightingCharge
 *   @property {number} eventSupportFee
 *   @property {number} decorationFee
 *   @property {number} subtotalAmount
 *   @property {number} discount
 *   @property {number} gstAmount
 *   @property {number} gstPercent
 *   @property {number} grandTotal
 *   @property {number} advance
 *   @property {number} refundAmount
 *   @property {number} netReceived
 *   @property {number} balanceDue
 *
 * @returns {Promise<{filePath: string, fileName: string, invoiceNo: string}>}
 */
const generateBanquetInvoicePdf = async (booking) => {
  ensureOutputDir();

  const safeId = String(booking.bookingId || booking.id || booking.customerId || "unknown");
  const safeInvoiceNo = String(booking.invoiceNo || `BNQ-${String(safeId).padStart(6, "0")}`)
    .replace(/[^A-Za-z0-9\-]/g, "_");
  const fileName = `invoice_banquet_${safeInvoiceNo}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // ── Theme ────────────────────────────────────────────────────────────────────
  const TEAL_DEEP = "#0B4F48";
  const TEAL = "#0F6E64";
  const AMBER = "#C8791A";
  const ROSE = "#B5442E";
  const INK = "#1C231F";
  const INK_SOFT = "#4A4E44";
  const MUTED = "#6B6F66";
  const LINE = "#E4E1D8";
  const BAND = "#F6F5F1";
  const ALT_ROW = "#FAF9F6";
  const WHITE = "#FFFFFF";

  // ── Parse date ───────────────────────────────────────────────────────────────
  const rawDate = booking.date || booking.billedAt || new Date().toISOString().slice(0, 10);
  const dateObj = new Date(rawDate + "T00:00:00");
  const formattedDate =
    dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : rawDate;

  // ── Format time slot ────────────────────────────────────────────────────────
  const startTime = booking.startTime || "18:00";
  const endTime = booking.endTime || "22:00";

  // ── Computed values ──────────────────────────────────────────────────────────
  const hallCharge = round2(booking.hallCharge || 0);
  const mealCharge = round2(booking.mealCharge || 0);
  const customMenuCharge = round2(booking.customMenuCharge || 0);
  const lightingCharge = round2(booking.lightingCharge || 0);
  const eventSupportCharge = round2(booking.eventSupportFee || 0);
  const decorationFee = round2(booking.decorationFee || 0);
  const discount = round2(booking.discount || 0);
  const gstPercent = Number(booking.gstPercent || 5);
  const subTotal = round2(booking.subtotalAmount || hallCharge + mealCharge + customMenuCharge + lightingCharge + eventSupportCharge + decorationFee);
  const taxableAmount = round2(Math.max(0, subTotal - discount));
  const gstAmount = round2(booking.gstAmount || Math.round((taxableAmount * gstPercent) / 100) / 100);
  const grandTotal = round2(booking.grandTotal || taxableAmount + gstAmount);
  const advance = round2(booking.advance || 0);
  const refundAmount = round2(booking.refundAmount || 0);
  const netReceived = round2(booking.netReceived || Math.max(0, advance - refundAmount));
  const balanceDue = round2(booking.balanceDue || Math.max(0, grandTotal - netReceived));
  const hoursText = booking.hours
    ? `${booking.hours} hr${booking.hours !== 1 ? "s" : ""}`
    : "";

  // ── Build PDF ────────────────────────────────────────────────────────────────
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const stream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    // ── HEADER BAND ───────────────────────────────────────────────────────────
    const headerH = 108;
    const gradientStops = 60;
    for (let i = 0; i < gradientStops; i++) {
      const t = i / (gradientStops - 1);
      const r = Math.round(parseInt(TEAL_DEEP.slice(1, 3), 16) * (1 - t) + parseInt(TEAL.slice(1, 3), 16) * t);
      const g = Math.round(parseInt(TEAL_DEEP.slice(3, 5), 16) * (1 - t) + parseInt(TEAL.slice(3, 5), 16) * t);
      const b = Math.round(parseInt(TEAL_DEEP.slice(5, 7), 16) * (1 - t) + parseInt(TEAL.slice(5, 7), 16) * t);
      doc.save();
      doc.rect(0, (headerH * i) / gradientStops, 595.28, headerH / gradientStops + 0.5)
        .fillColor(`rgb(${r},${g},${b})`)
        .fill();
      doc.restore();
    }

    // Logo placeholder
    doc.fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(24)
      .text("M", 48, 28, { width: 54, align: "center" });

    doc.fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("Maa Baglamukhi Resort", 120, 22, { width: 340 });

    doc.font("Helvetica")
      .fontSize(10)
      .fillColor("#BFDBFE")
      .text("Banquet & Events", 120, 50, { width: 340 });

    // Invoice pill
    const pillW = 120;
    const pillX = 595.28 - 48 - pillW;
    doc.fillColor(AMBER).roundedRect(pillX, 32, pillW, 28, 14).fill();
    doc.fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("INVOICE", pillX, 39, { width: pillW, align: "center" });

    doc.font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(WHITE)
      .text(`#${safeInvoiceNo}`, 120, 72, { continued: true, width: 250 })
      .font("Helvetica")
      .fillColor("#E0F2FE")
      .text(`  ·  ${formattedDate}`, { width: 260 });

    // ── DETAILS GRID ──────────────────────────────────────────────────────────
    const gridY = headerH + 16;
    const colW = (595.28 - 96 - 16) / 2;

    // Left card — Guest details
    doc.fillColor(BAND).roundedRect(48, gridY, colW, 96, 8).fill();
    doc.strokeColor(LINE).lineWidth(0.8).roundedRect(48, gridY, colW, 96, 8).stroke();

    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("GUEST DETAILS", 62, gridY + 12);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(booking.customerName || "Guest", 62, gridY + 26);
    if (booking.phone) {
      doc.font("Helvetica").fontSize(10).fillColor(INK_SOFT).text(`Phone: ${booking.phone}`, 62, gridY + 44);
    }
    if (booking.guestEmail) {
      doc.font("Helvetica").fontSize(10).fillColor(INK_SOFT).text(`Email: ${booking.guestEmail}`, 62, gridY + 58);
    }
    if (booking.eventTitle) {
      doc.font("Helvetica").fontSize(10).fillColor(INK_SOFT).text(`Event: ${booking.eventTitle}`, 62, gridY + 72);
    }

    // Right card — Event details
    const rightX = 48 + colW + 16;
    doc.fillColor(BAND).roundedRect(rightX, gridY, colW, 96, 8).fill();
    doc.strokeColor(LINE).lineWidth(0.8).roundedRect(rightX, gridY, colW, 96, 8).stroke();

    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("EVENT DETAILS", rightX + 14, gridY + 12);
    const eventRows = [
      ["Hall", booking.hallName || "N/A"],
      ["Date", formattedDate],
      ["Time", `${startTime} - ${endTime}${hoursText ? ` (${hoursText})` : ""}`],
      ["Guests", String(booking.guests || 0)],
      ["Meal", booking.mealSection || "N/A"],
    ];
    eventRows.forEach(([label, value], idx) => {
      const ry = gridY + 28 + idx * 14;
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, rightX + 14, ry, { width: 50 });
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(value, rightX + 64, ry, { width: colW - 78 });
    });

    // ── ITEMS TABLE ───────────────────────────────────────────────────────────
    const tableY = gridY + 112;
    const tableW = 595.28 - 96;
    const tableHdrH = 26;

    const rowH = 22;
    const lineItems = [
      { label: `Hall Charges${hoursText ? ` (${hoursText})` : ""}`, amount: hallCharge },
      { label: "Food / Meal Charges", amount: mealCharge },
      { label: "Custom Menu Charges", amount: customMenuCharge },
      { label: "Lighting Setup", amount: lightingCharge },
      { label: "Event Support", amount: eventSupportCharge },
      { label: "Decoration", amount: decorationFee },
    ].filter((item) => item.amount > 0);

    // Table header
    doc.fillColor(TEAL).roundedRect(48, tableY, tableW, tableHdrH, 4).fill();
    doc.fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("DESCRIPTION", 62, tableY + 8, { width: tableW - 140 })
      .text("AMOUNT", 48 + tableW - 100, tableY + 8, { width: 90, align: "right" });

    let cursorY = tableY + tableHdrH;

    lineItems.forEach((item, idx) => {
      if (idx % 2 === 0) {
        doc.fillColor(ALT_ROW).rect(48, cursorY, tableW, rowH).fill();
      }
      doc.fillColor(INK)
        .font("Helvetica")
        .fontSize(10)
        .text(item.label, 62, cursorY + 7, { width: tableW - 140 });
      doc.font("Helvetica-Bold")
        .fillColor(INK)
        .text(`${INR} ${formatINR(item.amount)}`, 48 + tableW - 100, cursorY + 7, {
          width: 90,
          align: "right",
        });
      cursorY += rowH;
    });

    // Bottom border
    cursorY += 2;
    doc.save().strokeColor(LINE).lineWidth(0.6)
      .moveTo(48, cursorY).lineTo(48 + tableW, cursorY).stroke().restore();
    cursorY += 10;

    // Subtotal row
    doc.font("Helvetica").fontSize(10).fillColor(INK_SOFT)
      .text("Subtotal", 62, cursorY, { width: tableW - 140 });
    doc.font("Helvetica-Bold")
      .fillColor(INK)
      .text(`${INR} ${formatINR(subTotal)}`, 48 + tableW - 100, cursorY, { width: 90, align: "right" });
    cursorY += 18;

    // Discount row
    if (discount > 0) {
      doc.font("Helvetica").fontSize(10).fillColor(ROSE)
        .text("Discount", 62, cursorY, { width: tableW - 140 });
      doc.font("Helvetica-Bold")
        .fillColor(ROSE)
        .text(`- ${INR} ${formatINR(discount)}`, 48 + tableW - 100, cursorY, { width: 90, align: "right" });
      cursorY += 18;

      doc.font("Helvetica").fontSize(10).fillColor(INK_SOFT)
        .text("Taxable Amount", 62, cursorY, { width: tableW - 140 });
      doc.font("Helvetica-Bold")
        .fillColor(INK)
        .text(`${INR} ${formatINR(taxableAmount)}`, 48 + tableW - 100, cursorY, { width: 90, align: "right" });
      cursorY += 18;
    }

    // GST row
    doc.font("Helvetica").fontSize(10).fillColor(INK_SOFT)
      .text(`GST (${gstPercent}%)`, 62, cursorY, { width: tableW - 140 });
    doc.font("Helvetica-Bold")
      .fillColor(INK)
      .text(`${INR} ${formatINR(gstAmount)}`, 48 + tableW - 100, cursorY, { width: 90, align: "right" });
    cursorY += 8;

    // Divider above grand total
    doc.save().strokeColor(TEAL).lineWidth(1.2)
      .moveTo(48, cursorY).lineTo(48 + tableW, cursorY).stroke().restore();
    cursorY += 6;

    // Grand total pill
    const pillH = 32;
    const pillGradStops = 30;
    for (let i = 0; i < pillGradStops; i++) {
      const t = i / (pillGradStops - 1);
      const r = Math.round(parseInt(TEAL_DEEP.slice(1, 3), 16) * (1 - t) + parseInt(TEAL.slice(1, 3), 16) * t);
      const g = Math.round(parseInt(TEAL_DEEP.slice(3, 5), 16) * (1 - t) + parseInt(TEAL.slice(3, 5), 16) * t);
      const b = Math.round(parseInt(TEAL_DEEP.slice(5, 7), 16) * (1 - t) + parseInt(TEAL.slice(5, 7), 16) * t);
      doc.save();
      doc.rect(48, cursorY + (pillH * i) / pillGradStops, tableW, pillH / pillGradStops + 0.5)
        .fillColor(`rgb(${r},${g},${b})`)
        .fill();
      doc.restore();
    }

    doc.fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("GRAND TOTAL", 62, cursorY + 8, { width: 140 });
    doc.fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(`${INR} ${formatINR(grandTotal)}`, 48 + tableW - 100, cursorY + 7, {
        width: 90,
        align: "right",
      });
    cursorY += pillH + 8;

    // ── PAYMENT SUMMARY ────────────────────────────────────────────────────────
    const payY = cursorY + 4;
    const payRowH = 20;
    const payColW = (tableW - 8) / 4;

    [
      { label: "Advance Paid", value: advance, color: "#059669" },
      { label: "Refunded", value: refundAmount, color: AMBER },
      { label: "Net Received", value: netReceived, color: "#059669" },
      { label: "Balance Due", value: balanceDue, color: ROSE },
    ].forEach((row, idx) => {
      const px = 48 + idx * (payColW + 4);
      doc.fillColor(WHITE).roundedRect(px, payY, payColW, payRowH + 16, 6).fill();
      doc.fillColor(MUTED)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(row.label, px, payY + 4, { width: payColW, align: "center" });
      doc.fillColor(row.color)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`${INR} ${formatINR(row.value)}`, px, payY + 14, { width: payColW, align: "center" });
    });

    cursorY = payY + payRowH + 22;

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = 770;
    doc.save().strokeColor(LINE).lineWidth(0.6)
      .moveTo(48, footerY).lineTo(48 + tableW, footerY).stroke().restore();

    doc.font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(TEAL)
      .text("Thank you for choosing Maa Baglamukhi Resort!", 48, footerY + 10, {
        width: tableW,
        align: "center",
      });

    doc.font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        "This is a computer-generated invoice and does not require a signature.",
        48,
        footerY + 26,
        { width: tableW, align: "center" },
      );

    doc.end();
  });

  return { filePath, fileName, invoiceNo: safeInvoiceNo };
};

module.exports = {
  generateBanquetInvoicePdf,
};
