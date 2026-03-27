const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

describe("Invoice APIs", () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  describe("GET /api/invoice/:customerId", () => {
    test("generates combined invoice", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);
      expect(res.body.customerName).toBe("John Carter");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.invoiceNo).toMatch(/^HOTINV-/);
    });

    test("returns 404 for missing customer", async () => {
      const res = await api().get("/api/invoice/999");
      expect(res.status).toBe(404);
    });

    test("includes hotel charges", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);
      expect(res.body.items.some((item) => item.category === "Hotel")).toBe(true);
    });

    test("includes served food charges only", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);
      expect(res.body.items.some((item) => String(item.name).includes("Veg Thali"))).toBe(true);
      expect(res.body.items.some((item) => String(item.name).includes("Should Not Bill"))).toBe(false);
    });

    test("computes subtotal correctly", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);
      expect(res.body.subtotal).toBe(2780);
    });

    test("computes GST at 5 percent", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);
      expect(res.body.tax).toBe(139);
    });

    test("applies advance and folio discount", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);
      expect(res.body.discount).toBe(150);
    });

    test("computes final total amount", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);
      expect(res.body.totalAmount).toBe(2769);
    });

    test("persists generated invoice row", async () => {
      await api().get("/api/invoice/1");
      const rows = await runQuery("SELECT COUNT(*) AS c FROM invoices WHERE booking_id = 1");
      expect(Number(rows[0]?.c || 0)).toBe(1);
    });

    test("stores JSON items on generated invoice", async () => {
      await api().get("/api/invoice/1");
      const rows = await runQuery("SELECT items_json FROM invoices WHERE booking_id = 1 LIMIT 1");
      expect(rows[0].items_json).toContain("Veg Thali");
    });

    test("matches subtotal against summed item totals", async () => {
      const res = await api().get("/api/invoice/1");
      expect(res.status).toBe(200);

      const computedSubtotal = res.body.items.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );

      expect(Number(computedSubtotal.toFixed(2))).toBe(res.body.subtotal);
    });
  });

  describe("manual invoice endpoints", () => {
    test("creates invoice manually", async () => {
      const res = await api().post("/api/invoice/create").send({
        invoiceNo: "MAN-1001",
        date: "2026-03-27",
        customerName: "Manual Guest",
        phone: "9991112222",
        roomNo: "201",
        checkIn: "2026-03-27",
        checkOut: "2026-03-28",
        pricePerDay: 1000,
        foodCharge: 200,
        extraCharge: 100,
        subtotal: 1300,
        gst: 65,
        discount: 50,
        finalTotal: 1315,
        totalAmount: 1315,
        paymentMode: "Cash",
        paymentStatus: "Pending",
        bookingId: 99,
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("returns all invoices", async () => {
      await api().get("/api/invoice/1");
      const res = await api().get("/api/invoice/all");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test("returns invoice by booking id", async () => {
      await api().get("/api/invoice/1");
      const res = await api().get("/api/invoice/by-booking/1");
      expect(res.status).toBe(200);
      expect(res.body.booking_id).toBe(1);
    });

    test("returns null for missing invoice by booking id", async () => {
      const res = await api().get("/api/invoice/by-booking/999");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    test("updates invoice row", async () => {
      await api().get("/api/invoice/1");
      const rows = await runQuery("SELECT id FROM invoices WHERE booking_id = 1 LIMIT 1");

      const res = await api().put(`/api/invoice/update/${rows[0].id}`).send({
        date: "2026-03-27",
        customerName: "John Carter Updated",
        phone: "9990001111",
        roomNo: "101",
        checkIn: "2026-03-27",
        checkOut: "2026-03-29",
        pricePerDay: 2100,
        foodCharge: 580,
        extraCharge: 200,
        subtotal: 2960,
        gst: 148,
        discount: 150,
        totalAmount: 2958,
        paymentMode: "Cash",
        paymentStatus: "Pending",
        items: [{ name: "Updated Item" }],
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });
  });

  describe("payment status updates", () => {
    test("validates paymentStatus body", async () => {
      await api().get("/api/invoice/1");
      const rows = await runQuery("SELECT id FROM invoices WHERE booking_id = 1 LIMIT 1");
      const res = await api().patch(`/api/invoice/payment-status/${rows[0].id}`).send({});
      expect(res.status).toBe(400);
    });

    test("updates invoice payment status", async () => {
      await api().get("/api/invoice/1");
      const rows = await runQuery("SELECT id FROM invoices WHERE booking_id = 1 LIMIT 1");

      const res = await api()
        .patch(`/api/invoice/payment-status/${rows[0].id}`)
        .send({ paymentStatus: "Paid" });

      expect(res.status).toBe(200);

      const updated = await runQuery("SELECT payment_status FROM invoices WHERE id = ?", [rows[0].id]);
      expect(updated[0].payment_status).toBe("Paid");
    });

    test("preserves totals after payment status update", async () => {
      await api().get("/api/invoice/1");
      const rows = await runQuery("SELECT id, total_amount FROM invoices WHERE booking_id = 1 LIMIT 1");

      await api()
        .patch(`/api/invoice/payment-status/${rows[0].id}`)
        .send({ paymentStatus: "Paid" });

      const updated = await runQuery("SELECT total_amount FROM invoices WHERE id = ?", [rows[0].id]);
      expect(Number(updated[0].total_amount)).toBe(Number(rows[0].total_amount));
    });
  });
});
