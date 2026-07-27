/**
 * PrintConfig — printer selection and configuration.
 *
 * Defines all supported print types and their default printer assignments.
 * Admin can override via DB-driven settings in a future iteration.
 *
 * Default Printers:
 *   1. HP Smart Tank 580 Series (A4) — for GST invoices, reports, guest bills
 *   2. RP326 ESC/POS Thermal Receipt Printer (80mm) — for POS bills, KOT,
 *      Room Service bills, and payment receipts
 *
 * Supports:
 *   - ESC/POS Commands
 *   - Auto Paper Cut
 *   - Cash Drawer Open
 *   - Silent Printing
 */

/**
 * Supported printer definitions.
 *
 * printerKey: unique identifier used in code and env vars
 * name: human-readable printer name
 * type: "a4" or "thermal"
 * paperSize: "A4" or "80mm"
 * driver: "pdf-to-printer" or "escpos"
 * defaultFor: array of print type identifiers
 */
const PRINTERS = {
  A4_PRINTER: {
    printerKey: "A4_PRINTER",
    name: "HP Smart Tank 580 Series",
    type: "a4",
    paperSize: "A4",
    driver: "pdf-to-printer",
    defaultFor: [
      "gst_invoice",
      "advance_payment",
      "final_invoice",
      "restaurant_bill_a4",
      "room_service_bill_a4",
      "credit_settlement",
      "reservation_confirmation",
      "guest_registration",
      "checkout_bill",
      "folio_statement",
    ],
  },
  THERMAL_PRINTER: {
    printerKey: "THERMAL_PRINTER",
    name: "RP326 ESC/POS Thermal Receipt Printer",
    type: "thermal",
    paperSize: "80mm",
    driver: "escpos",
    defaultFor: [
      "restaurant_pos_bill",
      "room_service_bill",
      "kot",
      "advance_receipt",
      "cash_receipt",
      "refund_receipt",
      "payment_receipt",
      "kot_customer_copy",
    ],
  },
};

/**
 * Print type metadata — describes what each print type means and which printer.
 */
const PRINT_TYPES = {
  gst_invoice: {
    label: "GST Invoice",
    printerKey: "A4_PRINTER",
    description: "GST compliant invoice for guest stay",
  },
  final_invoice: {
    label: "Final Invoice",
    printerKey: "A4_PRINTER",
    description: "Final billing invoice at checkout",
  },
  checkout_bill: {
    label: "Checkout Bill",
    printerKey: "A4_PRINTER",
    description: "Bill printed at guest checkout",
  },
  advance_payment: {
    label: "Advance Payment Receipt",
    printerKey: "A4_PRINTER",
    description: "Receipt for advance payment",
  },
  advance_receipt: {
    label: "Advance Payment Receipt",
    printerKey: "THERMAL_PRINTER",
    description: "Thermal receipt for advance payment",
  },
  restaurant_bill_a4: {
    label: "Restaurant Bill (A4)",
    printerKey: "A4_PRINTER",
    description: "A4 copy of restaurant bill",
  },
  room_service_bill_a4: {
    label: "Room Service Bill (A4)",
    printerKey: "A4_PRINTER",
    description: "A4 copy of room service bill",
  },
  restaurant_pos_bill: {
    label: "Restaurant POS Bill",
    printerKey: "THERMAL_PRINTER",
    description: "Thermal customer bill from restaurant",
  },
  room_service_bill: {
    label: "Room Service Bill",
    printerKey: "THERMAL_PRINTER",
    description: "Thermal bill for room service",
  },
  credit_settlement: {
    label: "Credit Settlement",
    printerKey: "A4_PRINTER",
    description: "Credit card settlement document",
  },
  reservation_confirmation: {
    label: "Reservation Confirmation",
    printerKey: "A4_PRINTER",
    description: "Booking confirmation document",
  },
  guest_registration: {
    label: "Guest Registration Form",
    printerKey: "A4_PRINTER",
    description: "Guest registration document",
  },
  kot: {
    label: "Kitchen Order Ticket",
    printerKey: "THERMAL_PRINTER",
    description: "Auto-printed KOT for kitchen",
  },
  cash_receipt: {
    label: "Cash Receipt",
    printerKey: "THERMAL_PRINTER",
    description: "Thermal cash payment receipt",
  },
  refund_receipt: {
    label: "Refund Receipt",
    printerKey: "THERMAL_PRINTER",
    description: "Thermal refund receipt",
  },
  payment_receipt: {
    label: "Payment Receipt",
    printerKey: "THERMAL_PRINTER",
    description: "Thermal general payment receipt",
  },
  folio_statement: {
    label: "Folio Statement",
    printerKey: "A4_PRINTER",
    description: "Guest folio statement",
  },
};

/**
 * Resolve the printer key for a given print type.
 * Falls back to env var override, then default assignment.
 */
const getPrinterForType = (printType) => {
  const typeConfig = PRINT_TYPES[printType];
  if (typeConfig) {
    return typeConfig.printerKey;
  }
  // Unknown print types default to A4 printer
  return "A4_PRINTER";
};

/**
 * Get printer definition by key.
 */
const getPrinter = (printerKey) => PRINTERS[printerKey] || PRINTERS.A4_PRINTER;

/**
 * Get all configured printers.
 */
const getAllPrinters = () => Object.values(PRINTERS);

/**
 * Get all print types for a printer key.
 */
const getPrintTypesForPrinter = (printerKey) => {
  return Object.entries(PRINT_TYPES)
    .filter(([, config]) => config.printerKey === printerKey)
    .map(([key, config]) => ({ printType: key, ...config }));
};

/**
 * Resolve printer from environment override.
 * Env var: PRINT_PRINTER_OVERRIDE_<printType>
 * e.g., PRINT_PRINTER_OVERRIDE_kot=THERMAL_PRINTER
 */
const resolvePrinterWithOverride = (printType) => {
  const envKey = `PRINT_PRINTER_OVERRIDE_${printType.toUpperCase()}`;
  const override = process.env[envKey];
  if (override && PRINTERS[override]) {
    return override;
  }
  return getPrinterForType(printType);
};

module.exports = {
  PRINTERS,
  PRINT_TYPES,
  getPrinterForType,
  getPrinter,
  getAllPrinters,
  getPrintTypesForPrinter,
  resolvePrinterWithOverride,
};
