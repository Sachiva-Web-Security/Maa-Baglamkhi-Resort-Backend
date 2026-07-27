/**
 * PrintUtils — shared PDF generation and printer communication utilities.
 *
 * Provides:
 *   - PDF generation for A4 invoices (using pdfkit)
 *   - PDF generation for thermal receipt-like PDFs
 *   - PDF-to-printer dispatch using pdf-to-printer
 *   - Printer status checking
 */

const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const PrintConfig = require("../PrintConfig");

const OUTPUT_DIR =
  process.env.INVOICE_UPLOAD_DIR ||
  path.resolve(__dirname, "..", "uploads", "invoices");

const THERMAL_PDF_DIR =
  process.env.THERMAL_UPLOAD_DIR ||
  path.resolve(__dirname, "..", "uploads", "thermal");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(OUTPUT_DIR);
ensureDir(THERMAL_PDF_DIR);

const INR = "₹";
const formatINR = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ─── Theme (shared between A4 and thermal PDFs) ───────────────────────────────

const THEME = {
  primary: "#0F4C81",
  primaryDark: "#0A3A66",
  accent: "#F59E0B",
  ink: "#000000",
  inkSoft: "#000000",
  muted: "#000000",
  line: "#000000",
  band: "#F8FAFC",
  altRow: "#F1F5F9",
  white: "#FFFFFF",
};

const hexToRgb = (hex) => {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return [0, 0, 0];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const gradientFill = (doc, x, y, w, h, colorTop, colorBottom) => {
  const steps = Math.max(40, Math.round(h / 2));
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const [r1, g1, b1] = hexToRgb(colorTop);
    const [r2, g2, b2] = hexToRgb(colorBottom);
    const r = Math.round(r1 * (1 - t) + r2 * t);
    const g = Math.round(g1 * (1 - t) + g2 * t);
    const b = Math.round(b1 * (1 - t) + b2 * t);
    doc.save();
    doc.rect(x, y + (h * i) / steps, w, h / steps + 0.5).fillColor(`rgb(${r},${g},${b})`).fill();
    doc.restore();
  }
};

const drawRoundedRect = (doc, x, y, w, h, radius, fillColor, strokeColor) => {
  doc.save();
  if (fillColor) doc.fillColor(fillColor);
  if (strokeColor) doc.strokeColor(strokeColor).lineWidth(1);
  doc.roundedRect(x, y, w, h, radius);
  if (fillColor && strokeColor) doc.fillAndStroke();
  else if (fillColor) doc.fill();
  else if (strokeColor) doc.stroke();
  doc.restore();
};

// ─── PDF Generation ───────────────────────────────────────────────────────────

/**
 * Generate a professional A4 invoice PDF using pdfkit.
 * Used by InvoicePrintService for all A4 documents.
 */
const generateA4InvoicePdf = (invoiceData) => {
  ensureDir(OUTPUT_DIR);

  const safeId = String(invoiceData.bookingId || invoiceData.customerId || invoiceData.id || "unknown");
  const safeInvoiceNo = String(invoiceData.invoiceNo || `INV-${safeId}-${Date.now()}`).replace(/[^A-Za-z0-9\-]/g, "_");
  const fileName = `invoice_${safeInvoiceNo}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ filePath, fileName }));
    stream.on("error", reject);
    doc.pipe(stream);

    const PAGE_W = 595.28;
    const MARGIN_X = 50;
    const CONTENT_W = PAGE_W - MARGIN_X * 2;

    try {
      // ── Header ────────────────────────────────────────────────────────────
      doc.fillColor("#000000").fontSize(22).font("Helvetica-Bold").text("Maa Baglamukhi Resort", { align: "center" });
      doc.moveDown(0.2);
      doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold").text("Your Stay, Our Blessing", { align: "center" });
      doc.moveDown(0.2);
      doc.text("Contact: +91-XXXXXXXXXX | Email: info@maabaglamukhiresort.com", { align: "center" });
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#000000").lineWidth(1.2).stroke();

      // ── Invoice Meta ──────────────────────────────────────────────────────
      const metaY = doc.y + 10;
      doc.fillColor("#000000").fontSize(10).font("Helvetica-Bold");
      doc.text("INVOICE", 50, metaY);
      doc.text(`#${invoiceData.invoiceNo || "N/A"}`, 200, metaY);
      doc.text(`Date: ${invoiceData.date || "N/A"}`, 330, metaY);
      doc.y = metaY + 30;

      // Bill To
      doc.fillColor("#000000").font("Helvetica-Bold").text("BILL TO:", 50, doc.y);
      doc.fillColor("#000000").font("Helvetica");
      doc.text(invoiceData.customerName || "Guest", 50, doc.y + 14);
      doc.text(`Phone: ${invoiceData.phone || "N/A"}`, 50, doc.y + 28);
      doc.moveDown(0.8);

      // ── Booking Details ───────────────────────────────────────────────────
      doc.fillColor("#000000").font("Helvetica-Bold").text("BOOKING DETAILS", { underline: true });
      doc.moveDown(0.1);
      const detailRows = [
        ["Booking ID", String(invoiceData.bookingId || invoiceData.customerId || "N/A")],
        ["Rooms", String(invoiceData.roomNumber || "N/A")],
        ["Check-In", String(invoiceData.checkIn || "N/A")],
        ["Check-Out", String(invoiceData.checkOut || "N/A")],
        ["Payment Mode", String(invoiceData.paymentMode || "Pending")],
        ["Status", String(invoiceData.paymentStatus || "Pending")],
      ];
      detailRows.forEach(([label, value]) => {
        doc.fillColor("#000000").font("Helvetica-Bold").text(label + ":", { continued: false });
        doc.fillColor("#000000").font("Helvetica").text(value, { continued: false, indent: 130 });
        doc.moveDown(0.1);
      });
      doc.moveDown(0.5);

      // ── Items Table ───────────────────────────────────────────────────────
      doc.fillColor("#000000").font("Helvetica-Bold").text("ITEM DETAILS", { underline: true });
      doc.moveDown(0.1);

      const colX = [50, 320, 390, 470, 530];
      const headerLabels = ["#", "Description", "Rate", "Qty", "Amount"];
      doc.fillColor("#000000").font("Helvetica-Bold");
      headerLabels.forEach((label, i) => {
        doc.text(label, colX[i], doc.y);
      });
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#000000").lineWidth(0.9).stroke();
      doc.moveDown(0.05);

      const items = Array.isArray(invoiceData.items) ? invoiceData.items : [];
      doc.fillColor("#000000").font("Helvetica");
      items.forEach((item, idx) => {
        const rowY = doc.y;
        doc.fillColor("#000000").text(String(idx + 1), colX[0], rowY);
        doc.text(String(item.name || item.category || "Charge"), colX[1], rowY);
        doc.text(`${INR} ${formatINR(item.price || 0)}`, colX[2], rowY);
        doc.text(String(item.quantity || 1), colX[3], rowY);
        doc.text(`${INR} ${formatINR(item.total || 0)}`, colX[4], rowY);
        doc.moveDown(0.25);
      });
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#000000").lineWidth(0.9).stroke();

      // ── Totals ────────────────────────────────────────────────────────────
      const totalsX = 370;
      const totalsStartY = doc.y + 10;
      const rightCol = 480;

      const subtotal = Number(invoiceData.subtotal || items.reduce((s, i) => s + (i.total || 0), 0));
      const tax = Number(invoiceData.tax || subtotal * 0.05);
      const discount = Number(invoiceData.discount || 0);
      const totalAmount = Number(invoiceData.totalAmount || subtotal + tax - discount);

      const totals = [
        ["Subtotal", subtotal],
        ["GST (5%)", tax],
        ["Discount", -discount],
        ["Grand Total", totalAmount],
      ];

      totals.forEach(([label, val], idx) => {
        const isLast = idx === totals.length - 1;
        doc.fillColor("#000000").font(isLast ? "Helvetica-Bold" : "Helvetica");
        doc.text(label, totalsX, totalsStartY + idx * 16, { width: 100 });
        doc.text(`${INR} ${formatINR(Math.abs(val))}`, rightCol, totalsStartY + idx * 16, {
          width: 80,
          align: "right",
        });
      });

      doc.y = totalsStartY + totals.length * 16 + 20;

      // ── Footer ────────────────────────────────────────────────────────────
      doc.moveDown(2);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#000000");
      doc.text("Thank you for choosing Maa Baglamukhi Resort.", { align: "center" });
      doc.text("This is a computer-generated invoice and does not require a signature.", { align: "center" });

      // Authorized signature block
      doc.moveDown(1);
      doc.text("Authorized Signature: _______________________", { align: "right" });

      doc.end();
    } catch (err) {
      doc.end();
      stream.destroy();
      fs.unlink(filePath, () => {});
      reject(err);
    }
  });
};

/**
 * Generate a thermal receipt PDF (mimics 80mm thermal paper).
 * @param {Buffer|null} escPosBuffer - raw ESC/POS buffer (unused, kept for compat)
 * @param {object|null} printer - printer config object (unused, kept for compat)
 * @param {string} textContent - plain text content to render
 */
const generateThermalPdf = (escPosBuffer, printer, textContent = "") => {
  ensureDir(THERMAL_PDF_DIR);

  const fileName = `thermal_${Date.now()}.pdf`;
  const filePath = path.join(THERMAL_PDF_DIR, fileName);

  // For thermal printers, we generate a narrow PDF (80mm = ~227pt)
  const doc = new PDFDocument({
    size: [227, 9999],
    margin: { top: 10, bottom: 10, left: 8, right: 8 },
  });

  const stream = fs.createWriteStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve({ filePath, fileName }));
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fillColor("#000000").fontSize(10).font("Courier-Bold");
    const lines = textContent.split("\n");
    for (const line of lines) {
      doc.text(line, { width: 211 });
    }

    doc.end();
  });
};

/**
 * Extract plain text from ESC/POS binary buffer.
 */
const extractTextFromEscPos = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return String(buffer || "");

  const lines = [];
  let currentLine = "";

  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];

    // Newline
    if (byte === 0x0a || byte === 0x0d) {
      lines.push(currentLine);
      currentLine = "";
      i++;
      continue;
    }

    // Skip ESC/POS commands
    if (byte === 0x1b) {
      i++;
      const cmd = buffer[i];
      if (cmd === 0x40) { // @ - initialize (1 byte)
        i++;
      } else if (cmd === 0x21) { // ! - font selection (2 bytes)
        i += 2;
      } else if (cmd === 0x61) { // a - alignment (2 bytes)
        i += 2;
      } else if (cmd === 0x45) { // E - bold (2 bytes)
        i += 2;
      } else if (cmd === 0x2d) { // - - underline (2 bytes)
        i += 2;
      } else if (cmd === 0x4d) { // M - font (2 bytes)
        i += 2;
      } else if (cmd === 0x64) { // d - feed lines (3 bytes)
        i += 3;
      } else if (cmd === 0x70) { // p - pulse (4 bytes)
        i += 4;
      } else if (cmd === 0x33 || cmd === 0x32) { // line spacing
        i += 2;
      } else {
        // Unknown ESC sequence, skip 1-2 bytes
        i += 2;
      }
      continue;
    }

    // Skip GS commands
    if (byte === 0x1d) {
      i++;
      const cmd = buffer[i];

      if (cmd === 0x21) { // ! - print mode (2 bytes)
        i += 2;
      } else if (cmd === 0x56) { // V - cut (2 bytes)
        i += 2;
      } else if (cmd === 0x68) { // h - barcode height (3 bytes)
        i += 3;
      } else if (cmd === 0x77) { // w - barcode width (3 bytes)
        i += 3;
      } else if (cmd === 0x6b) { // k - barcode (variable)
        i++;
        const len = buffer[i] + 2;
        i += len;
      } else if (cmd === 0x28) { // ( - GS ( commands (QR, etc.)
        i++;
        const func = buffer[i];
        i++;
        const pl = buffer[i];
        const ph = buffer[i + 1];
        const totalLen = pl + ph * 256;
        i += totalLen + 2;
      } else {
        i += 2;
      }
      continue;
    }

    // Regular ASCII character
    if (byte >= 0x20 && byte < 0x7f) {
      currentLine += String.fromCharCode(byte);
    }
    i++;
  }

  if (currentLine) lines.push(currentLine);

  return lines.join("\n");
};

/**
 * Send a PDF file to the Windows printer using pdf-to-printer.
 */
const printPdfToPrinter = async (filePath, printerName) => {
  try {
    // Check if pdf-to-printer is available
    let ptpCommand = "pdf-to-printer";
    try {
      await execAsync(`where ${ptpCommand}`, { shell: "cmd.exe" });
    } catch {
      ptpCommand = "npx pdf-to-printer";
    }

    // Escape the printer name for Windows
    const safePrinterName = printerName.replace(/"/g, '\\"');

    const cmd = `${ptpCommand} "${filePath}" "${safePrinterName}" --silent`;

    const { stdout, stderr } = await execAsync(cmd, {
      shell: "cmd.exe",
      timeout: 30000,
    });

    if (stderr && !stderr.includes("DeprecationWarning")) {
      console.warn("[Print] pdf-to-printer stderr:", stderr);
    }

    return { success: true, output: stdout };
  } catch (err) {
    console.error("[Print] Failed to print:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Check printer status (online/offline).
 */
const checkPrinterStatus = async (printerName) => {
  try {
    // On Windows, check printer status via PowerShell
    const script = `
      $printer = Get-Printer -Name "${printerName.replace(/"/g, '\\"')}" -ErrorAction SilentlyContinue
      if ($printer) {
        Write-Host "STATUS: $($printer.PrinterStatus)"
        Write-Host "PORT: $($printer.PortName)"
      } else {
        Write-Host "STATUS: NOT_FOUND"
      }
    `;

    const { stdout } = await execAsync(`powershell -Command "${script.replace(/"/g, '\\"')}"`, {
      shell: "cmd.exe",
      timeout: 10000,
    });

    const statusMatch = stdout.match(/STATUS: (\w+)/);
    const portMatch = stdout.match(/PORT: (.+)/);

    return {
      found: statusMatch !== null,
      status: statusMatch ? statusMatch[1] : "UNKNOWN",
      port: portMatch ? portMatch[1] : null,
      online: statusMatch && ["Ready", "Idle", "Printing"].includes(statusMatch[1]),
    };
  } catch (err) {
    return {
      found: false,
      status: "UNKNOWN",
      online: false,
      error: err.message,
    };
  }
};

module.exports = {
  generateA4InvoicePdf,
  generateThermalPdf,
  printPdfToPrinter,
  checkPrinterStatus,
  extractTextFromEscPos,
  ensureDir,
  formatINR,
  THEME,
  hexToRgb,
  gradientFill,
  drawRoundedRect,
};
