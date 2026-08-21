/**
 * PrintService — main printing orchestrator.
 *
 * This is the single entry point for all printing operations.
 * Other parts of the application should use this service rather than
 * calling individual print services directly.
 *
 * Usage:
 *   const { PrintService } = require("./services/PrintService");
 *
 *   // Queue a print job (background)
 *   await PrintService.print("gst_invoice", invoiceData);
 *
 *   // Immediate print (synchronous)
 *   const result = await PrintService.printNow("kot", kotData);
 *
 *   // Reprint
 *   await PrintService.reprint("kot", "KOT-123456");
 *
 *   // Check printer status
 *   await PrintService.getPrinterStatus("A4_PRINTER");
 *
 * Auto-triggered prints:
 *   - Check-in: Guest registration form
 *   - Check-out: Final invoice
 *   - Advance payment: Advance receipt
 *   - Kitchen order creation: KOT (auto)
 *   - Restaurant payment: POS bill + A4 copy
 */

const { InvoicePrintService } = require("./InvoicePrintService");
const { KitchenPrintService } = require("./KitchenPrintService");
const { RestaurantPrintService } = require("./RestaurantPrintService");
const PrintConfig = require("../PrintConfig");

class PrintServiceClass {
  /**
   * Queue a print job for background processing.
   * Returns immediately; printing happens asynchronously.
   */
  async print(printType, data = {}, priority = 0) {
    const { printQueue } = require("./PrintQueue");
    return await printQueue.enqueue(printType, data, priority, 3);
  }

  /**
   * Immediately print a document (waits for completion).
   */
  async printNow(printType, data = {}) {
    switch (printType) {
      case "kot":
      case "room_service_bill":
      case "kot_customer_copy": {
        const { KitchenPrintService } = require("./KitchenPrintService");
        return KitchenPrintService.immediatePrintKOT(data);
      }

      case "cash_receipt":
      case "refund_receipt":
      case "payment_receipt":
      case "advance_receipt": {
        const { ThermalPrintService } = require("./ThermalPrintService");
        return ThermalPrintService.printReceipt(printType, data);
      }

      case "restaurant_pos_bill":
      case "room_service_bill": {
        const { RestaurantPrintService } = require("./RestaurantPrintService");
        if (printType === "restaurant_pos_bill") {
          return RestaurantPrintService.immediatePrintRestaurantBill(data);
        }
        return RestaurantPrintService.printRoomServiceBill(data);
      }

      case "gst_invoice":
      case "final_invoice":
      case "restaurant_bill_a4":
      case "room_service_bill_a4":
      case "credit_settlement":
      case "reservation_confirmation":
      case "guest_registration":
      case "checkout_bill":
      case "folio_statement": {
        return InvoicePrintService.immediatePrintInvoice(printType, data);
      }

      default: {
        const printerKey = PrintConfig.resolvePrinterWithOverride(printType);
        const printer = PrintConfig.getPrinter(printerKey);

        if (printer.type === "thermal") {
          const { ThermalPrintService } = require("./ThermalPrintService");
          return ThermalPrintService.printReceipt(printType, data, printerKey);
        } else {
          return InvoicePrintService.immediatePrintInvoice(printType, data, printerKey);
        }
      }
    }
  }

  /**
   * Reprint a document by its identifier.
   */
  async reprint(printType, identifier, printedBy) {
    switch (printType) {
      case "kot": {
        const { KitchenPrintService } = require("./KitchenPrintService");
        return KitchenPrintService.reprintKOT(identifier, printedBy);
      }
      case "restaurant_pos_bill":
      case "restaurant_bill_a4": {
        const { RestaurantPrintService } = require("./RestaurantPrintService");
        return RestaurantPrintService.reprintRestaurantBill(identifier);
      }
      default: {
        return InvoicePrintService.reprintInvoice(printType, identifier, printedBy);
      }
    }
  }

  /**
   * Check if a printer is online.
   */
  async getPrinterStatus(printerKey) {
    const { checkPrinterStatus } = require("./PrintUtils");
    const resolvedKey = printerKey || "A4_PRINTER";
    const printer = PrintConfig.getPrinter(resolvedKey);
    return await checkPrinterStatus(printer.name);
  }

  /**
   * Get print history for an invoice or KOT.
   */
  async getHistory(filters = {}) {
    const PrintLogModel = require("../models/PrintLogModel");
    return PrintLogModel.getPrintHistory(filters);
  }

  /**
   * Get print count for a document.
   */
  async getPrintCount(invoiceNo, kotNo) {
    const PrintLogModel = require("../models/PrintLogModel");
    return PrintLogModel.getPrintCount(invoiceNo, kotNo);
  }

  /**
   * Get all supported print types.
   */
  getSupportedTypes() {
    return Object.entries(PrintConfig.PRINT_TYPES).map(([key, config]) => ({
      printType: key,
      label: config.label,
      printer: PrintConfig.getPrinter(config.printerKey).name,
    }));
  }
}

const PrintService = new PrintServiceClass();

module.exports = { PrintService, PrintServiceClass };
