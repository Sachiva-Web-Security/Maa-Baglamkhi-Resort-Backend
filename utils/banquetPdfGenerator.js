const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const fmtINR = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const drawHeader = (doc, title, subtitle) => {
  doc.rect(0, 0, doc.page.width, 80).fill("#4338ca");
  doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text("Maa Baglamukhi Resort", 40, 24);
  doc.fontSize(11).font("Helvetica").text(title, 40, 52);
  if (subtitle) doc.fontSize(10).text(subtitle, 40, 66);
  doc.fillColor("#000000");
  doc.moveDown(3);
};

const drawSection = (doc, title) => {
  doc.moveDown(0.4);
  doc.fillColor("#4338ca").font("Helvetica-Bold").fontSize(12).text(title);
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).stroke("#cbd5e1");
  doc.moveDown(0.4);
  doc.fillColor("#1f2937").font("Helvetica").fontSize(10);
};

const labelValue = (doc, label, value) => {
  doc.font("Helvetica-Bold").fillColor("#4b5563").text(`${label}: `, { continued: true });
  doc.font("Helvetica").fillColor("#111827").text(String(value ?? "—"));
};

const drawTable = (doc, rows) => {
  const startX = doc.x;
  const colWidth = (doc.page.width - 80) / 2;
  rows.forEach(([label, value]) => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fillColor("#4b5563").text(label, startX, y, { width: colWidth });
    doc.font("Helvetica").fillColor("#111827").text(String(value ?? "—"), startX + colWidth, y, {
      width: colWidth,
      align: "right",
    });
    doc.moveDown(0.2);
  });
};

const parseMenuItems = (customMenuItems) => {
  if (!customMenuItems) return [];
  if (Array.isArray(customMenuItems)) return customMenuItems;
  try {
    const parsed = JSON.parse(customMenuItems);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  return String(customMenuItems)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * Booking confirmation PDF — complete event details with menu/food list.
 */
const generateBanquetBookingPdf = async (booking) => {
  const uploadsDir = path.join(__dirname, "..", "uploads", "banquet");
  ensureDir(uploadsDir);
  const safeId = String(booking.id || Date.now()).replace(/[^a-zA-Z0-9\-_.]/g, "_");
  const fileName = `banquet-booking-${safeId}.pdf`;
  const filePath = path.join(uploadsDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    drawHeader(doc, "Banquet Booking Confirmation", `Booking #${booking.id || ""}`);

    drawSection(doc, "Customer & Event");
    drawTable(doc, [
      ["Customer Name", booking.customerName || booking.customer_name],
      ["Phone", booking.phone],
      ["Email", booking.guestEmail || booking.guest_email || "—"],
      ["Event Type", booking.eventType || booking.event_type],
      ["Event Title", booking.eventTitle || booking.event_title || "—"],
      ["Hall", booking.hallName || booking.hall_name],
      ["Guests", booking.guests],
      ["Date", fmtDate(booking.date)],
      ["Timing", `${booking.startTime || booking.start_time} - ${booking.endTime || booking.end_time}`],
    ]);

    drawSection(doc, "Menu Package");
    labelValue(doc, "Package", booking.menuPackageName || booking.menu_package_name || booking.menuPackageId || "Standard");
    if (booking.menuPackagePerGuest != null) {
      labelValue(doc, "Per Guest", fmtINR(booking.menuPackagePerGuest));
    }
    if (booking.mealSection) {
      labelValue(doc, "Meal Section", booking.mealSection);
    }

    const menuItems = parseMenuItems(booking.customMenuItems || booking.custom_menu_items);
    if (menuItems.length) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fillColor("#4b5563").text("Selected Food Items:");
      doc.font("Helvetica").fillColor("#111827");
      menuItems.forEach((item) => {
        const name = typeof item === "string" ? item : item.name || item.label || JSON.stringify(item);
        const price = typeof item === "object" && (item.price != null) ? `  (${fmtINR(item.price)})` : "";
        doc.text(`  • ${name}${price}`);
      });
    }

    if (booking.menuHighlights && Array.isArray(booking.menuHighlights) && booking.menuHighlights.length) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fillColor("#4b5563").text("Package Highlights:");
      doc.font("Helvetica").fillColor("#111827");
      booking.menuHighlights.forEach((h) => doc.text(`  • ${h}`));
    }

    drawSection(doc, "Setup & Add-ons");
    drawTable(doc, [
      ["Lighting", booking.lightingSystem || booking.lighting_system || "—"],
      ["Decoration Fee", fmtINR(booking.decorationFee || booking.decoration_fee)],
      ["Event Support Fee", fmtINR(booking.eventSupportFee || booking.event_support_fee)],
      ["Lighting Charge", fmtINR(booking.lightingCharge || booking.lighting_charge)],
      ["Custom Menu Charge", fmtINR(booking.customMenuCharge || booking.custom_menu_charge)],
    ]);

    drawSection(doc, "Charges");
    drawTable(doc, [
      ["Hall Charge", fmtINR(booking.hallCharge || booking.hall_charge)],
      ["Meal Charge", fmtINR(booking.mealCharge || booking.meal_charge)],
      ["Subtotal", fmtINR(booking.subtotalAmount || booking.subtotal_amount)],
      ["Discount", `- ${fmtINR(booking.discount)}`],
      [`GST (${booking.gstPercent || booking.gst_percent || 5}%)`, fmtINR(booking.gstAmount || booking.gst_amount)],
    ]);

    doc.moveDown(0.5);
    doc.rect(40, doc.y, doc.page.width - 80, 32).fill("#eef2ff");
    doc.fillColor("#4338ca").font("Helvetica-Bold").fontSize(13)
      .text("Grand Total", 50, doc.y - 24, { continued: true })
      .text(fmtINR(booking.grandTotal || booking.grand_total), { align: "right" });
    doc.moveDown(1);
    doc.fillColor("#1f2937").font("Helvetica").fontSize(10);
    drawTable(doc, [
      ["Advance Received", fmtINR(booking.advance)],
      ["Balance Due", fmtINR(booking.balanceDue || booking.balance_due)],
      ["Payment Mode", booking.paymentMode || booking.payment_mode || "—"],
      ["Payment Status", booking.paymentStatus || booking.payment_status || "Pending"],
    ]);

    if (booking.notes && String(booking.notes).trim()) {
      drawSection(doc, "Notes");
      doc.font("Helvetica").fillColor("#111827").text(String(booking.notes));
    }

    doc.moveDown(1.2);
    doc.fontSize(9).fillColor("#6b7280")
      .text("Thank you for choosing Maa Baglamukhi Resort. We look forward to hosting your event!", {
        align: "center",
      });

    doc.end();
    stream.on("finish", () => resolve({ filePath, fileName }));
    stream.on("error", (err) => reject(err));
  });
};

/**
 * Banquet bill PDF — final invoice issued after the event.
 */
const generateBanquetBillPdf = async (booking) => {
  const uploadsDir = path.join(__dirname, "..", "uploads", "banquet");
  ensureDir(uploadsDir);
  const safeInv = String(booking.invoiceNo || booking.invoice_no || `BNQ-${booking.id || Date.now()}`)
    .replace(/[^a-zA-Z0-9\-_.]/g, "_");
  const fileName = `${safeInv}.pdf`;
  const filePath = path.join(uploadsDir, fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    drawHeader(doc, "Banquet Tax Invoice", `Invoice No: ${booking.invoiceNo || booking.invoice_no || "—"}`);

    drawSection(doc, "Billed To");
    drawTable(doc, [
      ["Customer", booking.customerName || booking.customer_name],
      ["Phone", booking.phone],
      ["Email", booking.guestEmail || booking.guest_email || "—"],
      ["Event Type", booking.eventType || booking.event_type],
      ["Hall", booking.hallName || booking.hall_name],
      ["Event Date", fmtDate(booking.date)],
      ["Timing", `${booking.startTime || booking.start_time} - ${booking.endTime || booking.end_time}`],
      ["Guests", booking.guests],
    ]);

    drawSection(doc, "Itemised Charges");
    drawTable(doc, [
      ["Hall Charge", fmtINR(booking.hallCharge || booking.hall_charge)],
      ["Meal / Food Charge", fmtINR(booking.mealCharge || booking.meal_charge)],
      ["Custom Menu Charge", fmtINR(booking.customMenuCharge || booking.custom_menu_charge)],
      ["Decoration Fee", fmtINR(booking.decorationFee || booking.decoration_fee)],
      ["Lighting Charge", fmtINR(booking.lightingCharge || booking.lighting_charge)],
      ["Event Support Fee", fmtINR(booking.eventSupportFee || booking.event_support_fee)],
    ]);

    const menuItems = parseMenuItems(booking.customMenuItems || booking.custom_menu_items);
    if (menuItems.length) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fillColor("#4b5563").text("Food / Menu Items:");
      doc.font("Helvetica").fillColor("#111827");
      menuItems.forEach((item) => {
        const name = typeof item === "string" ? item : item.name || item.label || JSON.stringify(item);
        doc.text(`  • ${name}`);
      });
    }

    drawSection(doc, "Summary");
    drawTable(doc, [
      ["Subtotal", fmtINR(booking.subtotalAmount || booking.subtotal_amount)],
      ["Discount", `- ${fmtINR(booking.discount)}`],
      [`GST (${booking.gstPercent || booking.gst_percent || 5}%)`, fmtINR(booking.gstAmount || booking.gst_amount)],
    ]);

    doc.moveDown(0.5);
    doc.rect(40, doc.y, doc.page.width - 80, 32).fill("#eef2ff");
    doc.fillColor("#4338ca").font("Helvetica-Bold").fontSize(13)
      .text("Grand Total", 50, doc.y - 24, { continued: true })
      .text(fmtINR(booking.grandTotal || booking.grand_total), { align: "right" });
    doc.moveDown(1);
    doc.fillColor("#1f2937").font("Helvetica").fontSize(10);
    drawTable(doc, [
      ["Advance Paid", fmtINR(booking.advance)],
      ["Refund", `- ${fmtINR(booking.refundAmount || booking.refund_amount || 0)}`],
      ["Net Received", fmtINR(booking.netReceived || booking.net_received)],
      ["Balance Due", fmtINR(booking.balanceDue || booking.balance_due)],
      ["Payment Mode", booking.paymentMode || booking.payment_mode || "—"],
      ["Payment Status", booking.paymentStatus || booking.payment_status || "Pending"],
      ["Payment Ref", booking.paymentReferenceNo || booking.payment_reference_no || "—"],
    ]);

    doc.moveDown(1.2);
    doc.fontSize(9).fillColor("#6b7280")
      .text("Thank you for celebrating with us at Maa Baglamukhi Resort.", {
        align: "center",
      });

    doc.end();
    stream.on("finish", () => resolve({ filePath, fileName }));
    stream.on("error", (err) => reject(err));
  });
};

module.exports = {
  generateBanquetBookingPdf,
  generateBanquetBillPdf,
};
