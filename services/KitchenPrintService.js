/**
 * KitchenPrintService — automatic kitchen order ticket (KOT) printing.
 *
 * Flow:
 *   1. Waiter creates order → kitchenController.createOrder
 *   2. KitchenPrintService auto-prints KOT to thermal printer
 *   3. No manual action required
 *
 * Supports:
 *   - Dine-In orders
 *   - Room Service orders
 *   - Take Away orders
 *   - Auto paper cut
 *   - Reprint on demand
 */

const PrintConfig = require("../PrintConfig");
const PrintLogModel = require("../models/PrintLogModel");
const { printQueue } = require("./PrintQueue");
const { ThermalPrintService } = require("./ThermalPrintService");

/**
 * Automatically print a KOT when a kitchen order is created.
 * Called from kitchenController after order creation.
 */
const autoPrintKOT = async (orderData) => {
  const { kotNo, orderId, tableNumber, entityType, waiterName, items, prepTimeMinutes } = orderData;

  // Build KOT data
  const kotData = {
    kotNo: kotNo || `KOT-${Date.now()}`,
    orderNo: orderId ? `ORD-${String(orderId).padStart(5, "0")}` : "",
    tableNumber: tableNumber || "",
    table: tableNumber || "",
    roomNumber: entityType === "Room" ? tableNumber : "",
    room: entityType === "Room" ? tableNumber : "",
    guestName: orderData.guestName || "",
    waiterName: waiterName || "Waiter",
    waiter: waiterName || "Waiter",
    date: orderData.date || new Date(),
    orderType: entityType === "Room" ? "Room Service" : "Dine-In",
    items: Array.isArray(items) ? items : [],
    specialInstructions: orderData.specialInstructions || [],
    hotelName: orderData.hotelName || "Maa Baglamukhi Resort",
    printedBy: orderData.printedBy || "System",
  };

  try {
    // Queue the print job for background processing
    await printQueue.enqueue("kot", kotData, 10, 3);

    return {
      success: true,
      message: "KOT queued for printing",
      kotNo: kotData.kotNo,
    };
  } catch (err) {
    console.error("[KitchenPrint] Failed to queue KOT print:", err.message);
    return {
      success: false,
      kotNo: kotData.kotNo,
      error: err.message,
    };
  }
};

/**
 * Immediate (synchronous) print for when queue is not desired.
 * Use this when you need guaranteed delivery before returning response.
 */
const immediatePrintKOT = async (orderData) => {
  const { kotNo, orderId, tableNumber, entityType, waiterName, items } = orderData;

  const kotData = {
    kotNo: kotNo || `KOT-${Date.now()}`,
    orderNo: orderId ? `ORD-${String(orderId).padStart(5, "0")}` : "",
    tableNumber: tableNumber || "",
    table: tableNumber || "",
    roomNumber: entityType === "Room" ? tableNumber : "",
    room: entityType === "Room" ? tableNumber : "",
    guestName: orderData.guestName || "",
    waiterName: waiterName || "Waiter",
    waiter: waiterName || "Waiter",
    date: orderData.date || new Date(),
    orderType: entityType === "Room" ? "Room Service" : "Dine-In",
    items: Array.isArray(items) ? items : [],
    specialInstructions: orderData.specialInstructions || [],
    hotelName: orderData.hotelName || "Maa Baglamukhi Resort",
    printedBy: orderData.printedBy || "System",
  };

  try {
    const printerKey = PrintConfig.resolvePrinterWithOverride("kot");
    const result = await ThermalPrintService.printKOT(kotData, printerKey);

    // Log the print
    const printNo = PrintLogModel.buildPrintNo();
    await PrintLogModel.createPrintLog({
      printNo,
      kotNo: kotData.kotNo,
      printType: "kot",
      printerName: PrintConfig.getPrinter(printerKey).name,
      printedBy: kotData.printedBy,
      status: result.success ? "success" : "failed",
      errorMessage: result.error || null,
      metadata: {
        table: tableNumber,
        entityType,
        itemsCount: (Array.isArray(items) ? items : []).length,
      },
    });

    return result;
  } catch (err) {
    console.error("[KitchenPrint] Immediate print failed:", err.message);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Reprint a KOT.
 */
const reprintKOT = async (kotNo, printedBy) => {
  try {
    // Fetch the original KOT data from print logs
    const history = await PrintLogModel.getPrintHistory({ kotNo, printType: "kot" });
    const lastPrint = history[0];

    if (!lastPrint) {
      return { success: false, error: "KOT not found in print history" };
    }

    const metadata = typeof lastPrint.metadata === "string" ? JSON.parse(lastPrint.metadata) : lastPrint.metadata || {};

    // Build KOT data from metadata
    const kotData = {
      kotNo,
      orderNo: metadata.orderNo || "",
      tableNumber: metadata.table || "",
      table: metadata.table || "",
      roomNumber: metadata.room || "",
      room: metadata.room || "",
      guestName: metadata.guestName || "",
      waiterName: metadata.waiter || "",
      waiter: metadata.waiter || "",
      date: new Date(),
      orderType: metadata.entityType === "Room" ? "Room Service" : "Dine-In",
      items: metadata.items || [],
      specialInstructions: metadata.specialInstructions || [],
      hotelName: "Maa Baglamukhi Resort",
      printedBy: printedBy || lastPrint.printed_by || "System",
    };

    const printerKey = PrintConfig.resolvePrinterWithOverride("kot");
    const result = await ThermalPrintService.printKOT(kotData, printerKey);

    // Log reprint
    await PrintLogModel.createPrintLog({
      kotNo,
      printType: "kot",
      printerName: PrintConfig.getPrinter(printerKey).name,
      printedBy: kotData.printedBy,
      status: result.success ? "success" : "failed",
      errorMessage: result.error || null,
      metadata: { reprint: true, originalPrintId: lastPrint.id },
    });

    return { success: result.success, kotNo, isReprint: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

module.exports = {
  KitchenPrintService: {
    autoPrintKOT,
    immediatePrintKOT,
    reprintKOT,
  },
};
