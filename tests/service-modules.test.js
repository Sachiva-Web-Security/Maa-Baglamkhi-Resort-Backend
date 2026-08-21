const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

jest.setTimeout(120000);

describe("Banquet, Token, Kitchen, and Room Service APIs", () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  describe("banquet", () => {
    test("loads banquet dashboard", async () => {
      const res = await api().get("/api/banquet");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.halls)).toBe(true);
      expect(Array.isArray(res.body.bookings)).toBe(true);
      expect(res.body.pricingConfig).toBeTruthy();
      expect(Array.isArray(res.body.pricingConfig.menuPackages)).toBe(true);
    });

    test("loads and updates banquet pricing config", async () => {
      const getRes = await api().get("/api/banquet/config");
      expect(getRes.status).toBe(200);
      expect(getRes.body.pricingConfig.eventSupportFee).toBe(12000);

      const updateRes = await api().put("/api/banquet/config").send({
        ...getRes.body.pricingConfig,
        eventSupportFee: 18500,
        decorServiceFee: 22000,
        lightingOptions: getRes.body.pricingConfig.lightingOptions.map((item) =>
          item.id === "premium" ? { ...item, price: 31000 } : item
        ),
      });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.pricingConfig.eventSupportFee).toBe(18500);
      expect(updateRes.body.pricingConfig.decorServiceFee).toBe(22000);
      expect(
        updateRes.body.pricingConfig.lightingOptions.find(
          (item) => item.id === "premium"
        ).price
      ).toBe(31000);

      const dashboardRes = await api().get("/api/banquet");
      expect(dashboardRes.body.pricingConfig.eventSupportFee).toBe(18500);
    });

    test("adds banquet hall", async () => {
      const res = await api().post("/api/banquet/halls").send({
        name: "Garden Hall",
        capacity: 120,
        ratePerHour: 3500,
        is_ac: false,
      });

      expect(res.status).toBe(201);
      expect(res.body.hall.name).toBe("Garden Hall");
    });

    test("validates banquet hall payload", async () => {
      const res = await api().post("/api/banquet/halls").send({
        name: "Invalid Hall",
      });
      expect(res.status).toBe(400);
    });

    test("creates banquet booking", async () => {
      const res = await api().post("/api/banquet").send({
        hallId: 1,
        customerName: "Event Host",
        eventType: "Birthday",
        guests: 80,
        date: "2026-04-01",
        startTime: "18:00:00",
        endTime: "21:00:00",
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
    });

    test("persists banquet financial snapshot in dashboard", async () => {
      const createRes = await api().post("/api/banquet").send({
        hallId: 1,
        customerName: "Finance Host",
        phone: "9999999999",
        guestEmail: "finance@test.com",
        eventTitle: "Corporate Dinner",
        eventType: "Corporate",
        guests: 120,
        menuPackageId: "premium",
        mealSection: "Main Course",
        customMenuItems: "Live Pasta, Desserts",
        lightingSystem: "premium",
        customMenuCharge: 4500,
        lightingCharge: 15000,
        eventSupportFee: 12000,
        hallCharge: 20000,
        mealCharge: 30000,
        decorationFee: 5000,
        notes: "Finance banquet booking",
        date: "2026-04-04",
        startTime: "18:00:00",
        endTime: "22:00:00",
        discount: 2500,
        gstPercent: 5,
        subtotalAmount: 86500,
        gstAmount: 4200,
        grandTotal: 90700,
        advance: 25000,
        refundAmount: 0,
        paymentMode: "UPI",
        paymentStatus: "Partial",
        paymentReferenceNo: "BNQ-UPI-001",
      });

      expect(createRes.status).toBe(201);

      const dashboardRes = await api().get("/api/banquet");
      expect(dashboardRes.status).toBe(200);

      const createdBooking = dashboardRes.body.bookings.find(
        (booking) => booking.id === createRes.body.id,
      );

      expect(createdBooking).toBeTruthy();
      expect(createdBooking.hallCharge).toBe(20000);
      expect(createdBooking.mealCharge).toBe(30000);
      expect(createdBooking.customMenuCharge).toBe(4500);
      expect(createdBooking.subtotalAmount).toBe(86500);
      expect(createdBooking.gstAmount).toBe(4200);
      expect(createdBooking.grandTotal).toBe(90700);
      expect(createdBooking.paymentMode).toBe("UPI");
      expect(createdBooking.paymentStatus).toBe("Partial");
      expect(createdBooking.balanceDue).toBe(65700);
    });

    test("updates banquet booking", async () => {
      const res = await api().put("/api/banquet/1").send({
        hallId: 1,
        customerName: "Updated Host",
        phone: "8888888888",
        guestEmail: "updated@test.com",
        eventTitle: "Updated Wedding",
        eventType: "Wedding",
        guests: 180,
        menuPackageId: "royal",
        mealSection: "Main Course",
        customMenuItems: "Paneer, Dessert",
        lightingSystem: "premium",
        decorationFee: 7500,
        notes: "Updated booking notes",
        date: "2026-03-30",
        startTime: "12:00:00",
        endTime: "16:00:00",
        discount: 1000,
        gstPercent: 5,
        advance: 15000,
      });

      expect(res.status).toBe(200);
    });

    test("validates banquet booking payload", async () => {
      const res = await api().post("/api/banquet").send({
        hallId: 1,
        customerName: "Event Host",
      });
      expect(res.status).toBe(400);
    });

    test("rejects overlapping banquet booking", async () => {
      const res = await api().post("/api/banquet").send({
        hallId: 1,
        customerName: "Conflict Host",
        eventType: "Conference",
        guests: 90,
        date: "2026-03-30",
        startTime: "19:00:00",
        endTime: "21:00:00",
      });

      expect(res.status).toBe(409);
    });

    test("marks banquet booking complete", async () => {
      const res = await api().put("/api/banquet/1/complete").send({});
      expect(res.status).toBe(200);
    });

    test("cancels banquet booking", async () => {
      const res = await api().put("/api/banquet/1/cancel").send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Cancelled");
    });

    test("refunds banquet booking advance", async () => {
      const res = await api().put("/api/banquet/1/refund").send({
        refundAmount: 2500,
      });

      expect(res.status).toBe(200);
      expect(res.body.refundAmount).toBe(2500);
      expect(res.body.netReceived).toBe(7500);
      expect(res.body.balanceDue).toBeGreaterThanOrEqual(0);
    });

    test("deletes cancelled banquet booking", async () => {
      const cancelRes = await api().put("/api/banquet/1/cancel").send({});
      expect(cancelRes.status).toBe(200);

      const deleteRes = await api().delete("/api/banquet/1");
      expect(deleteRes.status).toBe(200);
    });

    test("prevents deleting banquet booking before it is cancelled or refunded", async () => {
      const deleteRes = await api().delete("/api/banquet/1");

      expect(deleteRes.status).toBe(400);
      expect(deleteRes.body.message).toMatch(/cancelled or refunded/i);
    });

    test("generates banquet bill", async () => {
      const res = await api().put("/api/banquet/1/bill").send({
        invoiceNo: "BNQ-1001",
      });
      expect(res.status).toBe(200);

      const dashboardRes = await api().get("/api/banquet");
      const billedBooking = dashboardRes.body.bookings.find((booking) => booking.id === 1);
      expect(billedBooking.invoiceNo).toBe("BNQ-1001");
      expect(billedBooking.status).toBe("Billed");
    });

    test("updates banquet hall", async () => {
      const res = await api().put("/api/banquet/halls/1").send({
        name: "Grand Ballroom Plus",
        capacity: 320,
        ratePerHour: 6500,
        is_ac: true,
        status: "Maintenance",
      });

      expect(res.status).toBe(200);
      expect(res.body.hall.name).toBe("Grand Ballroom Plus");
    });

    test("deletes banquet hall without active bookings", async () => {
      const createRes = await api().post("/api/banquet/halls").send({
        name: "Temporary Hall",
        capacity: 80,
        ratePerHour: 2200,
        is_ac: false,
      });

      expect(createRes.status).toBe(201);

      const hallId = createRes.body.hall.id;
      const deleteRes = await api().delete(`/api/banquet/halls/${hallId}`);
      expect(deleteRes.status).toBe(200);
    });

    test("prevents deleting banquet hall with active bookings", async () => {
      const deleteRes = await api().delete("/api/banquet/halls/1");

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.message).toMatch(/active banquet bookings/i);
    });
  });

  describe("token", () => {
    test("creates token", async () => {
      const res = await api().post("/api/token/create").send({
        tableNumber: "T5",
        waiter: "Waiter Two",
      });
      expect(res.status).toBe(200);
      expect(res.body.tokenId).toBeTruthy();
    });

    test("validates token create payload", async () => {
      const res = await api().post("/api/token/create").send({});
      expect(res.status).toBe(400);
    });

    test("gets active token by table", async () => {
      const res = await api().get("/api/token/table/T1");
      expect(res.status).toBe(200);
      expect(res.body.tableNumber).toBe("T1");
    });

    test("adds token item", async () => {
      const res = await api().post("/api/token/item").send({
        tokenId: 1,
        name: "Extra Naan",
        qty: 2,
        rate: 35,
      });
      expect(res.status).toBe(200);
    });

    test("gets token items", async () => {
      const res = await api().get("/api/token/items/1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    test("updates token item", async () => {
      const res = await api().put("/api/token/item").send({
        id: 1,
        qty: 4,
        rate: 220,
      });
      expect(res.status).toBe(200);
    });

    test("deletes token item", async () => {
      const res = await api().delete("/api/token/item/2");
      expect(res.status).toBe(200);
    });

    test("closes active token", async () => {
      const res = await api().put("/api/token/close/T1").send({});
      expect(res.status).toBe(200);
    });

    test("creates a fresh token when the previous active token is already paid", async () => {
      await runQuery(
        `
          INSERT INTO bills (
            tableNumber, token_id, entityType, waiter_name, subtotal, gst, total, paymentMethod, invoiceStatus, account_transaction_id
          )
          VALUES ('T1', 1, 'Table', 'Waiter One', 100, 5, 105, 'Cash', 'Paid', 99)
        `,
      );

      const res = await api().post("/api/token/create").send({
        tableNumber: "T1",
        waiter: "Waiter Two",
      });

      expect(res.status).toBe(200);
      expect(res.body.existing).toBe(false);
      expect(Number(res.body.tokenId)).not.toBe(1);

      const oldTokenRows = await runQuery("SELECT status FROM tokens WHERE id = 1");
      const newTokenRows = await runQuery("SELECT id, status, token_code FROM tokens WHERE id = ?", [res.body.tokenId]);

      expect(oldTokenRows[0].status).toBe("closed");
      expect(newTokenRows[0].status).toBe("active");
      expect(newTokenRows[0].token_code).toMatch(/^VIS-/);
    });
  });

  describe("kitchen", () => {
    test("creates kitchen order", async () => {
      const res = await api().post("/api/kitchen/order").send({
        table: "T3",
        waiter: "Waiter Three",
        entityType: "Table",
        items: [{ name: "Soup", quantity: 2, price: 100 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.order.id).toBeTruthy();
    });

    test("lists kitchen orders", async () => {
      const res = await api().get("/api/kitchen/orders");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("updates kitchen order status", async () => {
      const res = await api().put("/api/kitchen/orders/1").send({
        status: "Ready",
        prepTimeMinutes: 15,
      });
      expect(res.status).toBe(200);
    });

    test("returns 404 for missing kitchen order", async () => {
      const res = await api().put("/api/kitchen/orders/999").send({
        status: "Ready",
      });
      expect(res.status).toBe(404);
    });

    test("saves kitchen order to accounts", async () => {
      const res = await api().put("/api/kitchen/orders/1/save").send({});
      expect(res.status).toBe(200);
      expect(res.body.accountEntry.amount).toBeGreaterThan(0);
    });

    test("cancels kitchen order", async () => {
      const res = await api().put("/api/kitchen/orders/1/cancel").send({});
      expect(res.status).toBe(200);
    });
  });

  describe("room service", () => {
    test("adds room service room", async () => {
      const res = await api().post("/api/room-service/rooms").send({
        number: "701",
      });
      expect(res.status).toBe(200);
    });

    test("rejects missing room number", async () => {
      const res = await api().post("/api/room-service/rooms").send({});
      expect(res.status).toBe(400);
    });

    test("lists room service rooms", async () => {
      const res = await api().get("/api/room-service/rooms");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("adds room service menu item", async () => {
      const res = await api().post("/api/room-service/menu").send({
        name: "Room Tea",
        price: 50,
        category: "Beverage",
      });
      expect(res.status).toBe(200);
    });

    test("lists room service menu items", async () => {
      const res = await api().get("/api/room-service/menu");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("adds room service order item", async () => {
      const res = await api().post("/api/room-service/order/add").send({
        roomNumber: "101",
        item: { name: "Tea", price: 50, quantity: 2 },
      });
      expect(res.status).toBe(200);
      expect(res.body.orderId).toBeTruthy();
    });

    test("validates room service order payload", async () => {
      const res = await api().post("/api/room-service/order/add").send({});
      expect(res.status).toBe(400);
    });

    test("gets pending room order", async () => {
      const res = await api().get("/api/room-service/order/101");
      expect(res.status).toBe(200);
    });

    test("gets room order items", async () => {
      const res = await api().get("/api/room-service/order-items/1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("generates pending bill for room", async () => {
      const res = await api().get("/api/room-service/bill/101");
      expect([200, 404]).toContain(res.status);
    });

    test("creates room service bill", async () => {
      const res = await api().post("/api/room-service/bill").send({
        roomNumber: "101",
        subtotal: 100,
        gst: 10,
        total: 110,
        paymentMethod: "Cash",
      });
      expect(res.status).toBe(200);
    });

    test("updates room order status", async () => {
      const res = await api().put("/api/room-service/order/1/status").send({
        status: "served",
      });
      expect(res.status).toBe(200);
    });

    test("validates room order status", async () => {
      const res = await api().put("/api/room-service/order/1/status").send({
        status: "wrong",
      });
      expect(res.status).toBe(400);
    });

    test("pays room order", async () => {
      const res = await api().put("/api/room-service/order/101/pay").send({});
      expect([200, 404]).toContain(res.status);
    });
  });
});
