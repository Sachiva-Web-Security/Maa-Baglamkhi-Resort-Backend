jest.mock("../services/ThermalPrintService", () => ({
  ThermalPrintService: {
    printKOT: jest.fn(async (payload) => ({
      success: true,
      kotNo: payload.kotNo,
      printedBy: payload.printedBy,
    })),
    printReceipt: jest.fn(async (printType, payload) => ({
      success: true,
      printType,
      printedBy: payload.printedBy,
    })),
  },
}));

const { PrintQueue } = require("../services/PrintQueue");
const { ThermalPrintService } = require("../services/ThermalPrintService");

describe("PrintQueue dispatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("dispatches queued KOT jobs to the kitchen thermal printer", async () => {
    const queue = new PrintQueue();
    const result = await queue.executePrintJob({
      print_type: "kot",
      payload: JSON.stringify({
        kotNo: "KOT-TEST-1",
        orderId: 42,
        tableNumber: "T3",
        waiterName: "Waiter Three",
        items: [{ name: "Soup", quantity: 2, price: 100 }],
        printedBy: "Waiter Three",
      }),
    });

    expect(result.success).toBe(true);
    expect(result.kotNo).toBe("KOT-TEST-1");
    expect(ThermalPrintService.printKOT).toHaveBeenCalledWith(
      expect.objectContaining({
        kotNo: "KOT-TEST-1",
        tableNumber: "T3",
        waiterName: "Waiter Three",
      }),
      "THERMAL_PRINTER",
    );
  });

  test("dispatches queued restaurant POS bills to the thermal receipt printer", async () => {
    const queue = new PrintQueue();
    const result = await queue.executePrintJob({
      print_type: "restaurant_pos_bill",
      payload: JSON.stringify({
        receiptNo: "REST-TEST-1",
        tableNumber: "T1",
        amount: 525,
        paymentMethod: "Cash",
        printedBy: "Cashier",
      }),
    });

    expect(result.success).toBe(true);
    expect(ThermalPrintService.printReceipt).toHaveBeenCalledWith(
      "restaurant_pos_bill",
      expect.objectContaining({
        receiptNo: "REST-TEST-1",
        notes: "Table: T1",
        printedBy: "Cashier",
      }),
      "THERMAL_PRINTER",
    );
  });
});
