/**
 * ThermalPrintService — ESC/POS thermal printer integration.
 *
 * Supports:
 *   - ESC/POS command generation (raw binary)
 *   - Text wrapping at 80mm width
 *   - Bold, underline, double-height text
 *   - Auto paper cut
 *   - Cash drawer open (pulse)
 *   - Silent printing
 *   - Barcode printing
 *   - QR code printing
 *
 * Prints via:
 *   - Generates a thermal-width PDF via PrintUtils
 *   - Sends PDF to Windows printer via pdf-to-printer
 */

const PrintConfig = require("../PrintConfig");
const { printPdfToPrinter, generateThermalPdf } = require("./PrintUtils");

// ─── ESC/POS Command Constants ────────────────────────────────────────────────

const ESC = "\x1b";
const GS = "\x1d";

const ESC_POS = {
  INIT: [ESC, "@"],
  BOLD_ON: [ESC, "E", 1],
  BOLD_OFF: [ESC, "E", 0],
  NORMAL: [GS, "!", 0x00],
  ALIGN_LEFT: [ESC, "a", 0],
  ALIGN_CENTER: [ESC, "a", 1],
  ALIGN_RIGHT: [ESC, "a", 2],
  FEED_LINES: (n) => [ESC, "d", n],
  FEED_CUT: [GS, "V", 66],
  FULL_CUT: [GS, "V", 65],
  DRAWER_OPEN: [ESC, "p", 0, 25, 250],
};

// ─── Utility Functions ────────────────────────────────────────────────────────

const formatCurrency = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (date) => {
  if (!date) return "N/A";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatTime = (date) => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const centerText = (text, maxChars = 48) => {
  const textLen = String(text).length;
  const padding = Math.max(0, Math.floor((maxChars - textLen) / 2));
  return " ".repeat(padding) + text;
};

const divider = (char = "-", maxChars = 48) => char.repeat(maxChars);

// ─── Receipt Builders ────────────────────────────────────────────────────────

/**
 * Build a KOT (Kitchen Order Ticket) receipt as text lines.
 */
const buildKOTReceipt = (data) => {
  const hotelName = data.hotelName || "Maa Baglamukhi Resort";
  const kotNo = data.kotNo || "";
  const orderNo = data.orderNo || "";
  const tableNo = data.tableNumber || data.table || "";
  const roomNo = data.roomNumber || data.room || "";
  const guestName = data.guestName || "";
  const waiterName = data.waiterName || data.waiter || "";
  const date = formatDate(data.date || new Date());
  const time = formatTime(data.date || new Date());
  const orderType = data.orderType || (roomNo ? "Room Service" : "Dine-In");
  const items = Array.isArray(data.items) ? data.items : [];
  const specialInstructions = data.specialInstructions || [];

  const lines = [];

  // Header
  lines.push(centerText(hotelName, 48));
  lines.push(centerText("******** KITCHEN COPY ********", 48));
  lines.push(divider());

  // Order info
  if (kotNo) lines.push(`KOT No  : ${kotNo}`);
  if (orderNo) lines.push(`Order No: ${orderNo}`);
  lines.push(`Table   : ${tableNo}`);
  if (roomNo) lines.push(`Room    : ${roomNo}`);
  if (guestName) lines.push(`Guest   : ${guestName}`);
  lines.push(`Waiter  : ${waiterName}`);
  lines.push(`Date    : ${date}`);
  lines.push(`Time    : ${time}`);
  lines.push(`Type    : ${orderType}`);

  lines.push(divider());

  // Items (no prices for kitchen copy)
  lines.push("ITEMS");
  for (const item of items) {
    const name = item.name || item.itemName || "Unknown";
    const qty = Number(item.quantity || item.qty || 1);
    const note = item.specialInstructions || item.note || "";
    lines.push(`${String(qty).padStart(3)} x ${name}`);
    if (note) {
      lines.push(`  >> ${note}`);
    }
  }

  lines.push(divider());

  // Special instructions
  const allInstructions = [];
  for (const item of items) {
    if (item.specialInstructions || item.note) {
      allInstructions.push(`• ${item.specialInstructions || item.note}`);
    }
  }
  if (specialInstructions.length) {
    allInstructions.push(...specialInstructions.map((s) => `• ${s}`));
  }

  if (allInstructions.length > 0) {
    lines.push("Special Instructions");
    for (const inst of allInstructions) {
      lines.push(inst);
    }
    lines.push(divider());
  }

  lines.push(`Print Time: ${time}`);
  lines.push(divider());
  lines.push("");

  return lines.join("\n");
};

/**
 * Build a payment receipt (cash/advance/refund) as text lines.
 */
const buildPaymentReceipt = (data) => {
  const hotelName = data.hotelName || "Maa Baglamukhi Resort";
  const receiptNo = data.receiptNo || data.printNo || "";
  const guestName = data.guestName || "";
  const roomNo = data.roomNumber || "";
  const paymentType = data.paymentType || "Payment";
  const amount = data.amount || 0;
  const method = data.method || data.paymentMethod || "Cash";
  const date = formatDate(data.date || new Date());
  const time = formatTime(data.date || new Date());
  const notes = data.notes || "";

  const lines = [];

  lines.push(centerText(hotelName, 48));
  lines.push(centerText(paymentType.toUpperCase() + " RECEIPT", 48));
  lines.push(divider());

  if (receiptNo) lines.push(`No   : ${receiptNo}`);
  lines.push(`Date : ${date}`);
  lines.push(`Time : ${time}`);

  lines.push(divider());

  if (guestName) lines.push(`Guest : ${guestName}`);
  if (roomNo) lines.push(`Room  : ${roomNo}`);

  lines.push(divider());
  lines.push(centerText(paymentType.toUpperCase(), 48));
  lines.push(centerText(`Rs. ${formatCurrency(amount)}`, 48));
  lines.push(divider());

  lines.push(`Method : ${method}`);
  if (notes) lines.push(`Note   : ${notes}`);

  lines.push(divider());
  lines.push(centerText("Thank You!", 48));
  lines.push("");

  return lines.join("\n");
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Print a KOT to the thermal printer.
 * Generates a thermal-width PDF and sends it to the printer.
 */
const printKOT = async (data, printerKey = "KITCHEN_PRINTER") => {
  const printer = PrintConfig.getPrinter(printerKey);
  const receiptText = buildKOTReceipt(data);

  try {
    // KITCHEN_PRINTER (HP inkjet): generate A5-size PDF that HP drivers understand.
    // THERMAL_PRINTER: generate narrow 80mm thermal PDF.
    let pdfResult;
    if (printer.type === "inkjet" || printer.type === "a4") {
      pdfResult = await generateInkjetKOTPdf(data, printer.paperSize || "A5");
    } else {
      pdfResult = await generateThermalPdfFromText(receiptText);
    }

    // Send to printer
    const printResult = await printPdfToPrinter(pdfResult.filePath, printer.name);

    return {
      success: printResult.success,
      printerName: printer.name,
      kotNo: data.kotNo,
      printedBy: data.printedBy,
      printCount: 1,
      error: printResult.error || null,
    };
  } catch (err) {
    return {
      success: false,
      printerName: printer.name,
      kotNo: data.kotNo,
      printedBy: data.printedBy,
      error: err.message,
    };
  }
};

/**
 * Print a payment receipt to the thermal printer.
 */
const printReceipt = async (printType, data, printerKey = "THERMAL_PRINTER") => {
  const printer = PrintConfig.getPrinter(printerKey);
  const receiptText = buildPaymentReceipt(data);

  try {
    const pdfResult = await generateThermalPdfFromText(receiptText);
    const printResult = await printPdfToPrinter(pdfResult.filePath, printer.name);

    return {
      success: printResult.success,
      printerName: printer.name,
      printedBy: data.printedBy,
      printCount: 1,
      error: printResult.error || null,
    };
  } catch (err) {
    return {
      success: false,
      printerName: printer.name,
      printedBy: data.printedBy,
      error: err.message,
    };
  }
};

/**
 * Generate a thermal-width PDF from text content.
 */
const generateThermalPdfFromText = async (textContent) => {
  return generateThermalPdf(null, null, textContent);
};

/**
 * Generate a KOT PDF for inkjet printers (e.g. HP Smart Tank).
 * Uses A5 paper size — readable for kitchen staff and HP-compatible.
 */
const generateInkjetKOTPdf = async (data, paperSize = "A5") => {
  const path = require("path");
  const fs = require("fs");
  const PDFDocument = require("pdfkit");

  const OUTPUT_DIR =
    process.env.THERMAL_UPLOAD_DIR ||
    path.resolve(__dirname, "..", "uploads", "thermal");
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fileName = `kot_inkjet_${Date.now()}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // A5: 420 x 595 pt (roughly half of A4)
  // A4: 595 x 842 pt
  const sizeMap = {
    A5: [420, 595],
    A4: [595, 842],
  };
  const dims = sizeMap[paperSize] || sizeMap.A5;

  const doc = new PDFDocument({
    size: dims,
    margin: 20,
  });
  const stream = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ filePath, fileName }));
    stream.on("error", reject);
    doc.pipe(stream);

    // ── Header
    doc.fillColor("#000000").fontSize(18).font("Helvetica-Bold")
      .text("KITCHEN ORDER TICKET", { align: "center" });
    doc.moveDown(0.2);
    doc.fillColor("#444444").fontSize(9).font("Helvetica")
      .text("Hotel POS — Auto-Print", { align: "center" });
    doc.moveDown(0.5);

    // ── Divider
    doc.moveTo(20, doc.y).lineTo(dims[0] - 20, doc.y).strokeColor("#000000").lineWidth(1).stroke();
    doc.moveDown(0.5);

    // ── Meta info
    doc.fillColor("#000000").fontSize(11).font("Helvetica-Bold");
    const meta = [
      ["KOT No", data.kotNo || "—"],
      ["Order No", data.orderNo || "—"],
      ["Table/Room", data.tableNumber || data.table || data.roomNumber || "—"],
      ["Type", data.orderType || (data.roomNumber ? "Room Service" : "Dine-In")],
      ["Waiter", data.waiterName || data.waiter || "—"],
      ["Date/Time", `${formatDate(data.date || new Date())} ${formatTime(data.date || new Date())}`],
    ];
    meta.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(String(value));
    });
    doc.moveDown(0.5);

    doc.moveTo(20, doc.y).lineTo(dims[0] - 20, doc.y).strokeColor("#000000").lineWidth(1).stroke();
    doc.moveDown(0.5);

    // ── Items table header
    doc.fillColor("#000000").fontSize(11).font("Helvetica-Bold");
    doc.text("ITEMS", { align: "left", underline: true });
    doc.moveDown(0.3);

    const items = Array.isArray(data.items) ? data.items : [];
    const startY = doc.y;
    const colX = { idx: 25, name: 55, qty: dims[0] - 90, rate: dims[0] - 45 };

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("#", colX.idx, startY);
    doc.text("Item", colX.name, startY);
    doc.text("Qty", colX.qty, startY, { width: 40, align: "right" });
    doc.text("Rate", colX.rate, startY, { width: 40, align: "right" });
    doc.moveDown(0.3);

    doc.moveTo(20, doc.y).lineTo(dims[0] - 20, doc.y).strokeColor("#888888").lineWidth(0.5).stroke();
    doc.moveDown(0.2);

    doc.font("Helvetica").fontSize(10);
    items.forEach((item, idx) => {
      const y = doc.y;
      const qty = Number(item.quantity || item.qty || 1);
      const rate = Number(item.price || item.rate || 0);
      const name = String(item.name || item.itemName || "Item");
      doc.text(String(idx + 1), colX.idx, y);
      doc.text(name.slice(0, 32), colX.name, y, { width: dims[0] - 150 });
      doc.text(String(qty), colX.qty, y, { width: 40, align: "right" });
      doc.text(rate.toFixed(2), colX.rate, y, { width: 40, align: "right" });
      doc.moveDown(0.5);

      const note = item.specialInstructions || item.note || "";
      if (note) {
        doc.font("Helvetica-Oblique").fontSize(9).fillColor("#555555")
          .text(`>> ${note}`, colX.name + 10, doc.y, { width: dims[0] - 100 });
        doc.fillColor("#000000").font("Helvetica").fontSize(10);
      }
    });

    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(dims[0] - 20, doc.y).strokeColor("#000000").lineWidth(1).stroke();
    doc.moveDown(0.5);

    // ── Footer
    doc.fillColor("#000000").fontSize(9).font("Helvetica-Oblique")
      .text(`Printed: ${formatTime(new Date())} | Printed By: ${data.printedBy || "System"}`, {
        align: "center",
      });
    doc.moveDown(0.2);
    doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold")
      .text("-- KITCHEN COPY --", { align: "center" });

    doc.end();
  });
};

/**
 * Send ESC/POS raw data to the printer via thermal PDF conversion.
 */
const sendToPrinter = async (escPosBuffer, printer) => {
  try {
    const pdfResult = await generateThermalPdf(escPosBuffer, printer);
    const printResult = await printPdfToPrinter(pdfResult.filePath, printer.name);

    return {
      success: printResult.success,
      filePath: pdfResult.filePath,
      error: printResult.error || null,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
};

module.exports = {
  ThermalPrintService: {
    printKOT,
    printReceipt,
    sendToPrinter,
  },
  buildKOTReceipt,
  buildPaymentReceipt,
  generateInkjetKOTPdf,
  ESC_POS,
};
