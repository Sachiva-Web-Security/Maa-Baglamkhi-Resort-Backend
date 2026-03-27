const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase } = require("./helpers/testDb");

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

    test("generates banquet bill", async () => {
      const res = await api().put("/api/banquet/1/bill").send({
        invoiceNo: "BNQ-1001",
      });
      expect(res.status).toBe(200);
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
