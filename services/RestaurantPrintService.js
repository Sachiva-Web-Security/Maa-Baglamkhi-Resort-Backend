/**
 * RestaurantPrintService — restaurant POS bill printing.
 *
 * Handles:
 *   - Restaurant customer bills (thermal receipt)
 *   - KOT customer copies
 *   - Room service bills (thermal)
 *
 * Generates a professional thermal-width receipt PDF and sends to
 * the RP326 ESC/POS thermal printer via pdf-to-printer.
 */

const PrintConfig = require("../PrintConfig");
const PrintLogModel = require("../models/PrintLogModel");
const { printQueue } = require("./PrintQueue");
const { ThermalPrintService } = require("./ThermalPrintService");

/**
 * Auto-print a restaurant customer bill when payment is made.
 */
const autoPrintRestaurantBill = async (billData) => {
  const receiptData = {
    hotelName: "Maa Baglamukhi Resort",
    receiptNo: billData.invoiceNo || billData.billNumber || `REST-${Date.now()}`,
    guestName: billData.customerName || "",
    roomNumber: billData.roomNumber || "",
    paymentType: "Restaurant Bill",
    amount: billData.total || billData.grandTotal || 0,
    method: billData.paymentMethod || "Cash",
    date: billData.date || new Date(),
    notes: billData.notes || `Table: ${billData.tableNumber || billData.table || ""}`,
    printedBy: billData.printedBy || "System",
  };

  try {
    await printQueue.enqueue("restaurant_pos_bill", receiptData, 5, 3);
    return { success: true, message: "Restaurant bill queued for printing" };
  } catch (err) {
    console.error("[RestaurantPrint] Queue failed:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Immediate print of restaurant bill.
 */
const immediatePrintRestaurantBill = async (billData) => {
  const receiptData = {
    hotelName: "Maa Baglamukhi Resort",
    receiptNo: billData.invoiceNo || billData.billNumber || `REST-${Date.now()}`,
    guestName: billData.customerName || "",
    roomNumber: billData.roomNumber || "",
    paymentType: "Restaurant Bill",
    amount: billData.total || billData.grandTotal || 0,
    method: billData.paymentMethod || "Cash",
    date: billData.date || new Date(),
    notes: `Table: ${billData.tableNumber || billData.table || ""} | Items: ${Array.isArray(billData.items) ? billData.items.length : 0}`,
    printedBy: billData.printedBy || "System",
  };

  try {
    const printerKey = PrintConfig.resolvePrinterWithOverride("restaurant_pos_bill");
    const printer = PrintConfig.getPrinter(printerKey);
    const result = await ThermalPrintService.printReceipt("restaurant_pos_bill", receiptData, printerKey);

    await PrintLogModel.createPrintLog({
      invoiceNo: receiptData.receiptNo,
      printType: "restaurant_pos_bill",
      printerName: printer.name,
      printedBy: receiptData.printedBy,
      status: result.success ? "success" : "failed",
      errorMessage: result.error || null,
    });

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Print a room service bill.
 */
const printRoomServiceBill = async (billData) => {
  const receiptData = {
    hotelName: "Maa Baglamukhi Resort",
    receiptNo: billData.invoiceNo || billData.billNumber || `RS-${Date.now()}`,
    guestName: billData.guestName || "",
    roomNumber: billData.roomNumber || "",
    paymentType: "Room Service Bill",
    amount: billData.total || billData.grandTotal || 0,
    method: billData.paymentMethod || "Cash",
    date: billData.date || new Date(),
    notes: `Room Service | ${Array.isArray(billData.items) ? billData.items.length : 0} items`,
    printedBy: billData.printedBy || "System",
  };

  try {
    const printerKey = PrintConfig.resolvePrinterWithOverride("room_service_bill");
    const printer = PrintConfig.getPrinter(printerKey);
    const result = await ThermalPrintService.printReceipt("room_service_bill", receiptData, printerKey);

    await PrintLogModel.createPrintLog({
      invoiceNo: receiptData.receiptNo,
      printType: "room_service_bill",
      printerName: printer.name,
      printedBy: receiptData.printedBy,
      status: result.success ? "success" : "failed",
      errorMessage: result.error || null,
    });

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Print A4 copy of restaurant bill.
 */
const printRestaurantBillA4 = async (billData) => {
  const { InvoicePrintService } = require("./InvoicePrintService");
  return InvoicePrintService.printInvoice("restaurant_bill_a4", {
    ...billData,
    printedBy: billData.printedBy || "System",
  });
};

/**
 * Reproduce a restaurant bill print.
 */
const reprintRestaurantBill = async (invoiceNo) => {
  const { InvoicePrintService } = require("./InvoicePrintService");
  return InvoicePrintService.reprintInvoice("restaurant_pos_bill", invoiceNo);
};

module.exports = {
  RestaurantPrintService: {
    autoPrintRestaurantBill,
    immediatePrintRestaurantBill,
    printRoomServiceBill,
    printRestaurantBillA4,
    reprintRestaurantBill,
  },
};
