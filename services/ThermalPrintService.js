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
 * Tuned for readability on 80mm thermal printers — wider, well-spaced lines.
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

  // 80mm thermal paper — use 32 chars max line width for readability
  const W = 32;
  const lines = [];

  // ── Top border (heavy) ───────────────────────────────────────────────────
  lines.push("================================");
  // ── Hotel name (centered, big feel) ─────────────────────────────────────
  lines.push(centerText(hotelName.toUpperCase(), W));
  // ── KOT label box ───────────────────────────────────────────────────────
  lines.push("================================");
  lines.push(centerText("** KITCHEN ORDER TICKET **", W));
  lines.push(centerText("K O T", W));
  lines.push("================================");
  lines.push("");

  // ── Order info block ────────────────────────────────────────────────────
  lines.push(centerText("--- ORDER INFO ---", W));
  if (kotNo) lines.push(` KOT No   : ${kotNo}`);
  if (orderNo) lines.push(` Order No : ${orderNo}`);
  lines.push(` Table    : ${tableNo || "-"}`);
  if (roomNo) lines.push(` Room     : ${roomNo}`);
  if (guestName) lines.push(` Guest    : ${guestName}`);
  lines.push(` Waiter   : ${waiterName || "-"}`);
  lines.push(` Date     : ${date}`);
  lines.push(` Time     : ${time}`);
  lines.push(` Type     : ${orderType}`);
  lines.push("--------------------------------");
  lines.push("");

  // ── Items header (heavy) ────────────────────────────────────────────────
  lines.push("================================");
  lines.push(centerText("I T E M S", W));
  lines.push("================================");

  // Items — each gets a clear block with qty, name, and any note
  items.forEach((item, idx) => {
    const name = String(item.name || item.itemName || "Unknown");
    const qty = Number(item.quantity || item.qty || 1);
    const note = item.specialInstructions || item.note || "";

    lines.push("--------------------------------");
    lines.push(` #${String(idx + 1).padStart(2, "0")}   QTY: ${qty}`);
    lines.push(` >> ${name}`);
    if (note) {
      lines.push(`    NOTE: ${note}`);
    }
  });
  lines.push("--------------------------------");
  lines.push("");

  // ── Special instructions block ──────────────────────────────────────────
  const allInstructions = [];
  for (const item of items) {
    if (item.specialInstructions || item.note) {
      allInstructions.push(`${item.name || item.itemName || "Item"}: ${item.specialInstructions || item.note}`);
    }
  }
  if (specialInstructions.length) {
    allInstructions.push(...specialInstructions);
  }

  if (allInstructions.length > 0) {
    lines.push("================================");
    lines.push(centerText("SPECIAL INSTRUCTIONS", W));
    lines.push("================================");
    allInstructions.forEach((inst) => {
      const wrapped = wrapText(String(inst), W - 2);
      wrapped.forEach((w) => lines.push(`  ${w}`));
    });
    lines.push("--------------------------------");
    lines.push("");
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  lines.push("================================");
  lines.push(centerText("-- KITCHEN COPY --", W));
  lines.push(` Printed  : ${time}`);
  lines.push(` PrintedBy: ${data.printedBy || "System"}`);
  lines.push("================================");
  lines.push("");

  return lines.join("\n");
};

// Simple word-wrap helper for thermal receipts
const wrapText = (text, width) => {
  const out = [];
  const words = String(text).split(/\s+/);
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if ((line + " " + word).length <= width) {
      line += " " + word;
    } else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
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
 *
 * Defaults to FULL A4 with generous fonts so HP printers that auto-shrink
 * to fit the tray still produce a clearly readable KOT. A5 is honored only
 * when the caller explicitly requests it.
 *
 * Layout:
 *   - Big bold title block at top
 *   - 2-column meta grid with bold labels
 *   - Each item as a clearly bounded row with a giant quantity on the left
 *   - Special instructions in a highlighted block
 *   - Footer with print time and printed-by
 */
const generateInkjetKOTPdf = async (data, paperSize = "A4") => {
  const path = require("path");
  const fs = require("fs");
  const PDFDocument = require("pdfkit");

  const OUTPUT_DIR =
    process.env.THERMAL_UPLOAD_DIR ||
    path.resolve(__dirname, "..", "uploads", "thermal");
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fileName = `kot_inkjet_${Date.now()}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // A5: 420 x 595 pt  |  A4: 595 x 842 pt  |  Letter: 612 x 792 pt
  const sizeMap = {
    A5: [420, 595],
    A4: [595, 842],
    Letter: [612, 792],
  };
  const dims = sizeMap[paperSize] || sizeMap.A4;

  const PAGE_W = dims[0];
  const MARGIN = 30;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const doc = new PDFDocument({
    size: dims,
    margin: MARGIN,
  });
  const stream = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ filePath, fileName }));
    stream.on("error", reject);
    doc.pipe(stream);

    const INK = "#000000";
    const MUTED = "#333333";
    const RULE = "#000000";

    // ════ HEADER BLOCK ═════════════════════════════════════════════════════
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(36)
      .text("KITCHEN ORDER TICKET", { align: "center" });
    doc.moveDown(0.2);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(16)
      .text("Maa Baglamukhi Resort", { align: "center" });
    doc.moveDown(0.15);
    doc.fillColor(MUTED).font("Helvetica").fontSize(12)
      .text("Hotel POS — Auto-Print KOT", { align: "center" });
    doc.moveDown(0.4);

    // Heavy black rule under header
    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
      .strokeColor(RULE).lineWidth(3).stroke();
    doc.moveDown(0.5);

    // ════ META INFO — 2 columns, large fonts ══════════════════════════════
    const metaRows = [
      ["KOT No",     data.kotNo || "—"],
      ["Order No",   data.orderNo || "—"],
      ["Table/Room", data.tableNumber || data.table || data.roomNumber || "—"],
      ["Type",       data.orderType || (data.roomNumber ? "Room Service" : "Dine-In")],
      ["Waiter",     data.waiterName || data.waiter || "—"],
      ["Date/Time",  `${formatDate(data.date || new Date())} ${formatTime(data.date || new Date())}`],
    ];

    const colW = CONTENT_W / 2;
    const lineH = 30;
    metaRows.forEach(([label, value], idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = MARGIN + col * colW;
      const y = doc.y + row * lineH;

      doc.fillColor(INK).font("Helvetica-Bold").fontSize(16)
        .text(`${label}:`, x, y, { width: colW * 0.35 });
      doc.fillColor(INK).font("Helvetica").fontSize(16)
        .text(String(value), x + colW * 0.35, y, { width: colW * 0.65 });
    });
    doc.y = doc.y + Math.ceil(metaRows.length / 2) * lineH + 10;

    // Rule under meta
    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
      .strokeColor(RULE).lineWidth(2).stroke();
    doc.moveDown(0.5);

    // ════ ITEMS SECTION ═══════════════════════════════════════════════════
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22)
      .text("ITEMS", MARGIN, doc.y, { align: "left" });
    doc.moveDown(0.3);

    const items = Array.isArray(data.items) ? data.items : [];

    // Column layout: [GIANT QTY] [Item name] [spans full width for notes]
    const qtyColW = 110;
    const nameColX = MARGIN + qtyColW + 12;
    const nameColW = CONTENT_W - qtyColW - 12;

    items.forEach((item, idx) => {
      const yStart = doc.y;
      const qty = Number(item.quantity || item.qty || 1);
      const name = String(item.name || item.itemName || "Item");
      const note = item.specialInstructions || item.note || "";

      // Bordered row for each item — tall enough to hold giant qty
      const rowH = 56 + (note ? 26 : 0);
      doc.rect(MARGIN, yStart, CONTENT_W, rowH)
        .strokeColor(RULE).lineWidth(1.5).stroke();

      // GIANT quantity on left
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(44)
        .text(String(qty), MARGIN, yStart + 8, { width: qtyColW, align: "center" });
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(11)
        .text("QTY", MARGIN, yStart + rowH - 16, { width: qtyColW, align: "center" });

      // Item name — big and bold
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(22)
        .text(name, nameColX, yStart + 14, { width: nameColW });

      if (note) {
        doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(14)
          .text(`>> ${note}`, nameColX, yStart + 42, { width: nameColW });
      }

      doc.y = yStart + rowH + 6;
    });

    doc.moveDown(0.2);

    // ════ SPECIAL INSTRUCTIONS ════════════════════════════════════════════
    const allInstructions = [];
    items.forEach((item) => {
      if (item.specialInstructions || item.note) {
        allInstructions.push(`${item.name || item.itemName || "Item"}: ${item.specialInstructions || item.note}`);
      }
    });
    if (Array.isArray(data.specialInstructions)) {
      allInstructions.push(...data.specialInstructions);
    }

    if (allInstructions.length > 0) {
      doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
        .strokeColor(RULE).lineWidth(2).stroke();
      doc.moveDown(0.4);

      doc.fillColor(INK).font("Helvetica-Bold").fontSize(18)
        .text("SPECIAL INSTRUCTIONS", MARGIN, doc.y, { align: "left" });
      doc.moveDown(0.25);

      doc.fillColor(INK).font("Helvetica").fontSize(14);
      allInstructions.forEach((inst) => {
        doc.text(`• ${String(inst)}`, MARGIN + 10, doc.y, { width: CONTENT_W - 20 });
        doc.moveDown(0.15);
      });
    }

    // ════ FOOTER ═════════════════════════════════════════════════════════
    doc.moveDown(0.4);
    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
      .strokeColor(RULE).lineWidth(2).stroke();
    doc.moveDown(0.4);

    doc.fillColor(MUTED).font("Helvetica").fontSize(13)
      .text(`Printed: ${formatTime(new Date())}`, MARGIN, doc.y, {
        width: CONTENT_W / 2,
        align: "left",
      });

    doc.fillColor(MUTED).font("Helvetica").fontSize(13)
      .text(`By: ${data.printedBy || "System"}`, MARGIN + CONTENT_W / 2, doc.y - 16, {
        width: CONTENT_W / 2,
        align: "right",
      });
    doc.moveDown(0.5);

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(20)
      .text("-- KITCHEN COPY --", MARGIN, doc.y, {
        width: CONTENT_W,
        align: "center",
      });

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
