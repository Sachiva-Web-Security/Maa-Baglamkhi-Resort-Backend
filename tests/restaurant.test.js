const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase } = require("./helpers/testDb");

describe("Restaurant Order APIs", () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  describe("tables", () => {
    test("adds a table", async () => {
      const res = await api().post("/api/restaurant/tables").send({
        number: "T9",
        floorName: "First",
        sectionName: "Lounge",
        seatCount: 6,
        statusColor: "#111827",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("rejects missing table number", async () => {
      const res = await api().post("/api/restaurant/tables").send({});
      expect(res.status).toBe(400);
    });

    test("rejects duplicate table", async () => {
      const res = await api().post("/api/restaurant/tables").send({
        number: "T1",
      });

      expect(res.status).toBe(400);
    });

    test("returns table list", async () => {
      const res = await api().get("/api/restaurant/tables");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("menu", () => {
    test("adds menu item without image", async () => {
      const res = await api().post("/api/restaurant/menu").send({
        name: "Spring Roll",
        price: 150,
        category: "Starter",
        tableNumber: "T1",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test.each([
      [{ price: 100 }, 400],
      [{ name: "Tea" }, 400],
    ])("validates menu payload %#", async (payload, status) => {
      const res = await api().post("/api/restaurant/menu").send(payload);
      expect(res.status).toBe(status);
    });

    test("returns menu items", async () => {
      const res = await api().get("/api/restaurant/menu");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    test("filters menu by tableNumber", async () => {
      const res = await api().get("/api/restaurant/menu?tableNumber=T2");
      expect(res.status).toBe(200);
      expect(res.body.every((item) => item.table_number === "T2")).toBe(true);
    });

    test("exposes effective price", async () => {
      const res = await api().get("/api/restaurant/menu?tableNumber=T1");
      expect(res.status).toBe(200);
      expect(res.body.some((item) => item.effectivePrice)).toBe(true);
    });
  });

  describe("orders and bills", () => {
    test("adds order item to existing pending order", async () => {
      const res = await api().post("/api/restaurant/order/add").send({
        tableNumber: "T1",
        item: {
          name: "Soup",
          price: 120,
          quantity: 1,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.orderId).toBe(1);
    });

    test("creates a new order when no pending one exists", async () => {
      const res = await api().post("/api/restaurant/order/add").send({
        tableNumber: "T9",
        item: {
          name: "Soup",
          price: 120,
          quantity: 1,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/created/i);
    });

    test("returns pending order by table", async () => {
      const res = await api().get("/api/restaurant/order/T1");
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    test("returns undefined for table without pending order", async () => {
      const res = await api().get("/api/restaurant/order/T2");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    test("returns order items by order id", async () => {
      const res = await api().get("/api/restaurant/order-items/1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    test("marks order as paid", async () => {
      const res = await api().put("/api/restaurant/order/T1/pay").send({});
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/paid/i);
    });

    test("returns 404 when paying non-pending order", async () => {
      const res = await api().put("/api/restaurant/order/T2/pay").send({});
      expect(res.status).toBe(404);
    });

    test("creates restaurant bill", async () => {
      const res = await api().post("/api/restaurant/bill").send({
        table: "T1",
        entityType: "Table",
        customerName: "Walk In",
        phone: "8888888888",
        subtotal: 500,
        gst: 25,
        total: 525,
        paymentMethod: "Cash",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("returns saved bills", async () => {
      const res = await api().get("/api/restaurant/bills");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test("returns waiter performance", async () => {
      const res = await api().get("/api/restaurant/waiter-performance");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("item action requests and split bills", () => {
    test.each([
      [{}, 400],
      [{ tokenItemId: 1, tableNumber: "T1", actionType: "cancel" }, 400],
    ])("validates item action request payload %#", async (payload, status) => {
      const res = await api().post("/api/restaurant/item-action-requests").send(payload);
      expect(res.status).toBe(status);
    });

    test("creates item action request", async () => {
      const res = await api().post("/api/restaurant/item-action-requests").send({
        tokenItemId: 1,
        tableNumber: "T1",
        actionType: "cancel",
        reason: "Customer changed mind",
        requestedBy: "Waiter One",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("returns item action requests", async () => {
      await api().post("/api/restaurant/item-action-requests").send({
        tokenItemId: 1,
        tableNumber: "T1",
        actionType: "cancel",
        reason: "Customer changed mind",
        requestedBy: "Waiter One",
      });

      const res = await api().get("/api/restaurant/item-action-requests");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test("validates review status", async () => {
      const res = await api().put("/api/restaurant/item-action-requests/1/review").send({});
      expect(res.status).toBe(400);
    });

    test("reviews item action request", async () => {
      await api().post("/api/restaurant/item-action-requests").send({
        tokenItemId: 1,
        tableNumber: "T1",
        actionType: "cancel",
        reason: "Customer changed mind",
        requestedBy: "Waiter One",
      });

      const res = await api().put("/api/restaurant/item-action-requests/1/review").send({
        status: "Approved",
        managerNote: "Approved",
        approvedBy: "Manager One",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    test.each([
      [{}, 400],
      [{ tableNumber: "T1", splitLabel: "A" }, 400],
    ])("validates split bill payload %#", async (payload, status) => {
      const res = await api().post("/api/restaurant/split-bills").send(payload);
      expect(res.status).toBe(status);
    });

    test("creates split bill", async () => {
      const res = await api().post("/api/restaurant/split-bills").send({
        billId: 1,
        tableNumber: "T1",
        entityType: "Table",
        splitLabel: "Party A",
        splitNo: 1,
        splitCount: 2,
        subtotal: 250,
        gst: 12.5,
        total: 262.5,
        paymentMethod: "UPI",
        items: [{ name: "Paneer Tikka", quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });
  });
});
