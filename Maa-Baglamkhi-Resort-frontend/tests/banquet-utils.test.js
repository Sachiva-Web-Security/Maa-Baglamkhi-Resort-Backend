import {
  buildCustomMenuItemsText,
  buildNotesPayload,
  calculateBookingGrandTotal,
  calculateRestaurantMenuCharge,
  defaultPricingConfig,
  deriveBookingFinancials,
  getStoredPricingConfig,
  hoursBetween,
  normalizeBooking,
  parseRestaurantMenuSelection,
} from "../src/pages/banquetUtils.js";

describe("banquet utils", () => {
  afterEach(() => {
    delete global.window;
  });

  test("hoursBetween rounds up partial event durations", () => {
    expect(hoursBetween("18:00", "21:30")).toBe(4);
    expect(hoursBetween("18:15", "18:45")).toBe(1);
    expect(hoursBetween("22:00", "18:00")).toBe(0);
  });

  test("buildCustomMenuItemsText keeps unique trimmed items", () => {
    expect(
      buildCustomMenuItemsText(
        [" Paneer Tikka ", "Gulab Jamun"],
        ["Paneer Tikka", " Live Jalebi "]
      )
    ).toBe("Paneer Tikka, Gulab Jamun, Live Jalebi");
  });

  test("parseRestaurantMenuSelection normalizes numeric fields and drops blank items", () => {
    expect(
      parseRestaurantMenuSelection([
        {
          name: " Pasta Counter ",
          qty: "2",
          rate: "850",
          amount: "1700",
          taxAmount: "85",
          total: "1785",
        },
        { name: "   " },
      ])
    ).toEqual([
      {
        name: "Pasta Counter",
        qty: 2,
        rate: 850,
        amount: 1700,
        taxAmount: 85,
        total: 1785,
      },
    ]);
  });

  test("calculateRestaurantMenuCharge adds normalized totals", () => {
    expect(
      calculateRestaurantMenuCharge([
        { name: "Pasta Counter", total: "1785" },
        { name: "Dessert Bar", total: 945 },
      ])
    ).toBe(2730);
  });

  test("calculateBookingGrandTotal uses hall, menu, addons, discount, and gst", () => {
    const halls = [{ id: 7, ratePerHour: 5000 }];
    const booking = {
      hallId: 7,
      menuPackageId: "premium",
      lightingSystem: "stage",
      startTime: "18:00",
      endTime: "22:00",
      guests: 120,
      selectedRestaurantMenuItems: [{ name: "Dessert Bar", total: 4500 }],
      eventSupportFee: 12000,
      decorationFee: 5000,
      discount: 3000,
      gstPercent: 5,
    };

    expect(
      calculateBookingGrandTotal(booking, halls, defaultPricingConfig)
    ).toBe(175875);
  });

  test("deriveBookingFinancials computes balance due and paid status", () => {
    const halls = [{ id: 3, ratePerHour: 4000 }];
    const booking = {
      hallId: 3,
      menuPackageId: "standard",
      lightingSystem: "classic",
      startTime: "19:00",
      endTime: "22:00",
      guests: 100,
      selectedRestaurantMenuItems: [{ name: "Soup Station", total: 3000 }],
      eventSupportFee: 12000,
      decorationFee: 8000,
      discount: 5000,
      gstPercent: 5,
      advance: 120000,
    };

    expect(
      deriveBookingFinancials(booking, halls, defaultPricingConfig)
    ).toMatchObject({
      hallCharge: 12000,
      mealCharge: 65000,
      customMenuCharge: 3000,
      lightingCharge: 8000,
      subtotalAmount: 108000,
      taxableAmount: 103000,
      gstAmount: 5150,
      grandTotal: 108150,
      netReceived: 120000,
      balanceDue: 0,
      paymentStatus: "Paid",
    });
  });

  test("deriveBookingFinancials clears due for refunded bookings", () => {
    expect(
      deriveBookingFinancials(
        {
          status: "Refunded",
          grandTotal: 50000,
          advance: 15000,
          refundAmount: 15000,
        },
        [],
        defaultPricingConfig
      )
    ).toMatchObject({
      netReceived: 0,
      balanceDue: 0,
      paymentStatus: "Refunded",
    });
  });

  test("getStoredPricingConfig merges saved values with defaults", () => {
    global.window = {
      localStorage: {
        getItem: () =>
          JSON.stringify({
            mealSectionPrices: { Desserts: 180 },
            eventSupportFee: 18000,
          }),
      },
    };

    const config = getStoredPricingConfig();

    expect(config.eventSupportFee).toBe(18000);
    expect(config.decorServiceFee).toBe(defaultPricingConfig.decorServiceFee);
    expect(config.mealSectionPrices.Desserts).toBe(180);
    expect(config.menuPackages).toEqual(defaultPricingConfig.menuPackages);
  });

  test("normalizeBooking extracts banquet metadata and strips note markers", () => {
    const notes = buildNotesPayload("Please arrange stage flowers", {
      phone: "9999999999",
      guestEmail: "host@example.com",
      eventTitle: "Reception Night",
      mealSection: "Main Course",
      lightingSystem: "premium",
      eventSupportFee: 16000,
      paymentMode: "UPI",
      receiptFileName: "receipt.png",
      receiptFileDataUrl: "data:image/png;base64,abc",
      selectedCustomMenuItems: ["Paneer Tikka", "Soup"],
      manualCustomMenuItems: ["Live Jalebi"],
      selectedRestaurantMenuItems: [
        {
          name: "Dessert Counter",
          qty: 1,
          rate: 2500,
          amount: 2500,
          taxAmount: 125,
          total: 2625,
        },
      ],
      advance: 30000,
      refundAmount: 5000,
    });

    expect(
      normalizeBooking({
        id: 22,
        hall_id: 5,
        customer_name: "Rohan",
        event_type: "Reception",
        guests: "175",
        custom_menu_charge: "2625",
        hall_charge: "18000",
        meal_charge: "95000",
        grand_total: "145556",
        payment_reference_no: "BNQ-UPI-44",
        date: "2026-04-10T00:00:00.000Z",
        start_time: "18:00:00",
        end_time: "23:00:00",
        notes,
      })
    ).toMatchObject({
      hallId: 5,
      customerName: "Rohan",
      phone: "9999999999",
      guestEmail: "host@example.com",
      eventTitle: "Reception Night",
      mealSection: "Main Course",
      lightingSystem: "premium",
      customMenuItems: "Paneer Tikka, Soup, Live Jalebi",
      selectedCustomMenuItems: ["Paneer Tikka", "Soup"],
      manualCustomMenuItems: ["Live Jalebi"],
      selectedRestaurantMenuItems: [
        expect.objectContaining({
          name: "Dessert Counter",
          total: 2625,
        }),
      ],
      paymentReferenceId: "BNQ-UPI-44",
      advance: 30000,
      refundAmount: 5000,
      paymentReceived: 30000,
      notes: "Please arrange stage flowers",
    });
  });
});
