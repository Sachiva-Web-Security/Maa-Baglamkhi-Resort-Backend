/**
 * Restaurant Invoice PDF Service
 *
 * Generates a restaurant-specific A4 PDF invoice for table/room service bills,
 * and saves it under <UPLOADS_DIR>/invoices/.
 *
 * Reuses pdfkit (already a project dependency) and follows the same output
 * contract as `backend/services/invoicePdfService.js`.
 */

const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

// ─── Output directory ────────────────────────────────────────────────────────
const OUTPUT_DIR =
  process.env.INVOICE_UPLOAD_DIR ||
  path.resolve(__dirname, "..", "uploads", "invoices");

const ensureOutputDir = () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
};

// ─── Formatters ──────────────────────────────────────────────────────────────
const INR = "₹";

const formatINR = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const round2 = (value) => Number((Number(value || 0)).toFixed(2));

// ─── PDF builder ─────────────────────────────────────────────────────────────
const generateRestaurantInvoicePdf = async (bill) => {
  ensureOutputDir();

  const billId = Number(bill.id || bill.billId || 0);
  const invoiceNo = billId > 0 ? `REST-${String(billId).padStart(4, "0")}` : `REST-TMP-${Date.now()}`;
  const safeInvoiceNo = invoiceNo.replace(/[^A-Za-z0-9\-]/g, "_");
  const fileName = `invoice_restaurant_${safeInvoiceNo}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // --- Normalise data -------------------------------------------------------
  const customerName = bill.customerName || bill.customer_name || "Walk-in Customer";
  const phone = bill.phone || bill.customerPhone || "N/A";
  const entityLabel =
    String(bill.entityType || "Table").toLowerCase() === "room" ? "Room" : "Table";
  const tableOrRoom = bill.tableNumber || bill.table || "N/A";
  const visitId = bill.tokenCode || (bill.tokenId ? `VIS-${String(bill.tokenId).padStart(6, "0")}` : "N/A");
  const date = bill.date || bill.created_at ? new Date(bill.created_at || bill.date).toISOString().slice(0, 10) : "N/A";
  const time = bill.created_at
    ? new Date(bill.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "N/A";
  const waiter = bill.waiter_name || bill.waiterName || "N/A";
  const paymentMethod = bill.paymentMethod || "Cash";
  const paymentStatus = bill.invoiceStatus || "Generated";
  const subtotal = round2(bill.subtotal || 0);
  const gst = round2(bill.gst || 0);
  const sgst = round2(gst / 2);
  const cgst = round2(gst / 2);
  const discount = round2(bill.discountAmount || bill.discount || 0);
  const grandTotal = round2(subtotal + gst - discount);
  const items = Array.isArray(bill.items) ? bill.items : [];

  // --- Build PDF ------------------------------------------------------------
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(filePath);

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);

    // ── Branding header ──────────────────────────────────────────────────────
    doc.fontSize(22).font("Helvetica-Bold").text("Maa Baglamukhi Resort", { align: "center" });
    doc.moveDown(0.15);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Restaurant & POS Billing", { align: "center" });
    doc.moveDown(0.15);
    doc.text("Contact: +91-XXXXXXXXXX | info@maabaglamukhiresort.com", { align: "center" });
    doc
      .moveDown(0.6)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#cccccc")
      .lineWidth(1)
      .stroke();

    // ── Invoice meta ─────────────────────────────────────────────────────────
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("INVOICE", 50, doc.y + 8);
    doc.text(`#${invoiceNo}`, 200, doc.y);
    doc.text(`Date: ${date}`, 330, doc.y);
    doc.y += 22;

    // ── Bill to ──────────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").text("BILL TO:", 50, doc.y);
    doc.font("Helvetica");
    doc.text(customerName, 50, doc.y + 14);
    doc.text(`Phone: ${phone}`, 50, doc.y + 28);
    doc.y += 50;

    // ── Booking / Service details ────────────────────────────────────────────
    doc.font("Helvetica-Bold").text("SERVICE DETAILS", { underline: true });
    doc.moveDown(0.1);
    const detailRows = [
      ["Entity", `${entityLabel} ${tableOrRoom}`],
      ["Visit ID", String(visitId)],
      ["Date", date],
      ["Time", time],
      ["Waiter / Captain", waiter],
      ["Payment Mode", paymentMethod],
      ["Status", paymentStatus],
    ];
    detailRows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").text(label + ":", { continued: false });
      doc.font("Helvetica").text(value, { continued: false, indent: 130 });
      doc.moveDown(0.1);
    });
    doc.moveDown(0.4);

    // ── Items table ──────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").text("ORDERED ITEMS", { underline: true });
    doc.moveDown(0.1);

    const colX = [50, 310, 380, 430, 530]; // #, description, rate, qty, amount
    const headerLabels = ["#", "Item", "Rate", "Qty", "Amount"];
    doc.font("Helvetica-Bold");
    headerLabels.forEach((label, i) => {
      doc.text(label, colX[i], doc.y);
    });
    doc.y += 16;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(0.1);

    doc.font("Helvetica");
    if (items.length === 0) {
      doc.text("No items", colX[1], doc.y);
      doc.moveDown(0.4);
    } else {
      items.forEach((item, idx) => {
        const rowY = doc.y;
        const qty = Number(item.qty || item.quantity || 0);
        const rate = Number(item.rate || item.price || 0);
        const amount = round2(qty * rate);
        doc.text(String(idx + 1), colX[0], rowY);
        doc.text(String(item.name || "Item"), colX[1], rowY, { width: 60 });
        doc.text(`${INR} ${formatINR(rate)}`, colX[2], rowY);
        doc.text(String(qty), colX[3], rowY);
        doc.text(`${INR} ${formatINR(amount)}`, colX[4], rowY);
        doc.moveDown(0.3);
      });
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(0.4);

    // ── Totals ───────────────────────────────────────────────────────────────
    const totalsX = 350;
    const totalsStartY = doc.y;
    const rightCol = 470;

    const totals = [
      ["Subtotal", subtotal],
      [`SGST (${(sgst / subtotal) * 100}%)`, sgst > 0 ? sgst : round2(gst / 2)],
      [`CGST (${(cgst / subtotal) * 100}%)`, cgst > 0 ? cgst : round2(gst / 2)],
      ["Discount", -discount],
      ["Grand Total", grandTotal],
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
    doc.y = totalsStartY + totals.length * 16 + 24;

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fontSize(8).font("Helvetica").fillColor("#888888");
    doc.text("Thank you for dining with Maa Baglamukhi Resort.", { align: "center" });
    doc.text("This is a computer-generated invoice and does not require a signature.", { align: "center" });

    doc.end();
  });

  return { filePath, fileName, invoiceNo };
};

module.exports = {
  generateRestaurantInvoicePdf,
};
