/**
 * Invoice PDF Service — generates a professional PDF invoice for a booking.
 *
 * Uses pdfkit. The generated PDF is stored under <UPLOADS_DIR>/invoices/
 * and its public URL returned to the caller.
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

/**
 * Indian Rupee symbol helper.
 */
const INR = "₹";

/**
 * Format a plain number as Indian-format currency.
 *   1234.50 → "1,234.50"
 */
const formatINR = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Generate a PDF invoice for the given booking data and save it to disk.
 *
 * @param {object} booking
 *   @property {string|number} bookingId
 *   @property {string} invoiceNo
 *   @property {string} customerName
 *   @property {string} phone
 *   @property {string} roomNumber
 *   @property {string} checkIn     "YYYY-MM-DD"
 *   @property {string} checkOut    "YYYY-MM-DD"
 *   @property {string} date        "YYYY-MM-DD"
 *   @property {string} paymentMode
 *   @property {string} paymentStatus
 *   @property {number} subtotal
 *   @property {number} tax
 *   @property {number} discount
 *   @property {number} totalAmount
 *   @property {number} roomCharge
 *   @property {number} foodCharge
 *   @property {number} extraCharge
 *   @property {Array}  items       [{name, price, quantity, total}]
 *
 * @returns {Promise<{filePath: string, fileName: string}>}
 */
const generateInvoicePdf = async (booking) => {
  ensureOutputDir();

  const safeId = String(booking.bookingId || booking.customerId || "unknown");
  const safeInvoiceNo =
    String(booking.invoiceNo || `INV-${safeId}-${Date.now()}`).replace(
      /[^A-Za-z0-9\-]/g,
      "_",
    );
  const fileName = `invoice_${safeInvoiceNo}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    // ── Branding header ──────────────────────────────────────────────────
    doc.fontSize(22).font("Helvetica-Bold").text("Maa Baglamukhi Resort", { align: "center" });
    doc.moveDown(0.2);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Your Stay, Our Blessing", { align: "center" });
    doc.moveDown(0.2);
    doc.text("Contact: +91-XXXXXXXXXX | Email: info@maabaglamukhiresort.com", { align: "center" });
    doc
      .moveDown(0.6)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    // ── Invoice meta ─────────────────────────────────────────────────────
    const metaY = doc.y + 10;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("INVOICE", 50, metaY);
    doc.text(`#${booking.invoiceNo}`, 200, metaY);
    doc.text(`Date: ${booking.date || "N/A"}`, 330, metaY);

    doc.y = metaY + 30;

    doc.font("Helvetica-Bold");
    doc.text("BILL TO:", 50, doc.y);
    doc.font("Helvetica");
    doc.text(booking.customerName || "Guest", 50, doc.y + 14);
    doc.text(`Phone: ${booking.phone || "N/A"}`, 50, doc.y + 28);

    // ── Booking details ──────────────────────────────────────────────────
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text("BOOKING DETAILS", { underline: true });
    doc.moveDown(0.1);
    const detailRows = [
      ["Booking ID", String(booking.bookingId || safeId)],
      ["Rooms", String(booking.roomNumber || "N/A")],
      ["Check-In", String(booking.checkIn || "N/A")],
      ["Check-Out", String(booking.checkOut || "N/A")],
      ["Payment Mode", String(booking.paymentMode || "Pending")],
      ["Status", String(booking.paymentStatus || "Pending")],
    ];

    detailRows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").text(label + ":", { continued: false });
      doc.font("Helvetica").text(value, { continued: false, indent: 130 });
      doc.moveDown(0.1);
    });

    // ── Line-items table ─────────────────────────────────────────────────
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").text("ITEM DETAILS", { underline: true });
    doc.moveDown(0.1);

    const tableTop = doc.y;
    const colX = [50, 320, 390, 470, 530]; // sl, name, price, qty, total
    const headerLabels = ["#", "Description", "Rate", "Qty", "Amount"];

    doc.font("Helvetica-Bold");
    headerLabels.forEach((label, i) => {
      doc.text(label, colX[i], tableTop);
    });

    doc.y = tableTop + 16;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(0.15);

    doc.font("Helvetica");
    const items = Array.isArray(booking.items) ? booking.items : [];
    items.forEach((item, idx) => {
      const rowY = doc.y;
      doc.font("Helvetica").text(String(idx + 1), colX[0], rowY);
      doc.text(String(item.name || item.category || "Charge"), colX[1], rowY);
      doc.text(`${INR} ${formatINR(item.price)}`, colX[2], rowY);
      doc.text(String(item.quantity || 1), colX[3], rowY);
      doc.text(`${INR} ${formatINR(item.total)}`, colX[4], rowY);
      doc.moveDown(0.25);
    });

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();

    // ── Totals block ─────────────────────────────────────────────────────
    const totalsX = 370;
    const totalsStartY = doc.y + 10;
    const rightCol = 480;

    const totals = [
      ["Room Charge", booking.roomCharge || 0],
      ["Food Charge", booking.foodCharge || 0],
      ["Extra Charge", booking.extraCharge || 0],
      ["Subtotal", booking.subtotal || 0],
      ["GST (5%)", booking.tax || 0],
      ["Discount", -(booking.discount || 0)],
      ["Grand Total", booking.totalAmount || 0],
    ];

    totals.forEach(([label, val], idx) => {
      const isLast = idx === totals.length - 1;
      doc.font(isLast ? "Helvetica-Bold" : "Helvetica");
      doc.text(label, totalsX, totalsStartY + idx * 16, { width: 100 });
      doc.text(
        `${INR} ${formatINR(Math.abs(val))}`,
        rightCol,
        totalsStartY + idx * 16,
        { width: 80, align: "right" },
      );
    });

    doc.y = totalsStartY + totals.length * 16 + 20;

    // ── Footer ───────────────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fontSize(8).font("Helvetica").fillColor("#888888");
    doc.text("Thank you for choosing Maa Baglamukhi Resort.", {
      align: "center",
    });
    doc.text("This is a computer-generated invoice and does not require a signature.", {
      align: "center",
    });

    doc.end();
  });

  return { filePath, fileName };
};

module.exports = {
  generateInvoicePdf,
};
