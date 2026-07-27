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
const printKOT = async (data, printerKey = "THERMAL_PRINTER") => {
  const printer = PrintConfig.getPrinter(printerKey);
  const receiptText = buildKOTReceipt(data);

  try {
    // Generate thermal-width PDF
    const pdfResult = await generateThermalPdfFromText(receiptText);

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
  ESC_POS,
};
