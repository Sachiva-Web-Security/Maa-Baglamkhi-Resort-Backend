const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

describe("Hotel Booking and Folio APIs", () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  describe("guest creation and retrieval", () => {
    test("creates a guest booking", async () => {
      const res = await api().post("/api/hotel/guest").send({
        guestName: "New Guest",
        mobile: "9000000001",
        guestEmail: "newguest@test.com",
        checkIn: "2026-04-01",
        checkOut: "2026-04-03",
        arrival: "10:00",
        departure: "11:00",
        bookingStatus: "Confirmed",
      });

      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBeTruthy();
      expect(res.body.bookingCode).toMatch(/^BK-/);
    });

    test("reuses duplicate booking payload instead of inserting twice", async () => {
      const payload = {
        guestName: "Duplicate Guest",
        mobile: "9000000002",
        guestEmail: "dup@test.com",
        checkIn: "2026-04-10",
        checkOut: "2026-04-12",
        bookingStatus: "Confirmed",
      };

      const first = await api().post("/api/hotel/guest").send(payload);
      const second = await api().post("/api/hotel/guest").send(payload);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.bookingId).toBe(first.body.bookingId);
    });

    test("returns booking by id", async () => {
      const res = await api().get("/api/hotel/booking/1");
      expect(res.status).toBe(200);
      expect(res.body.guest_name).toBe("John Carter");
    });

    test("updates guest basic details", async () => {
      const res = await api().put("/api/hotel/booking/1").send({
        guest_name: "John Updated",
        mobile: "9991234567",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });
  });

  describe("booking related linked modules", () => {
    test("updates company details", async () => {
      const res = await api().post("/api/hotel/company/1").send({
        companyName: "Orbit Corp",
        gst: "GST-777",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/company/i);
    });

    test("rejects company when company name missing", async () => {
      const res = await api().post("/api/hotel/company/1").send({
        gst: "GST-777",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/company name is required/i);
    });

    test("reflects company update in full booking details", async () => {
      await api().post("/api/hotel/company/1").send({
        companyName: "Orbit Corp",
        gst: "GST-777",
      });

      const res = await api().get("/api/hotel/full-booking/1");
      expect(res.status).toBe(200);
      expect(res.body.company_name).toBe("Orbit Corp");
    });

    test("reflects company update in full booking details", async () => {
      await api().post("/api/hotel/company/1").send({
        companyName: "Orbit Corp",
        gst: "GST-777",
      });

      const res = await api().get("/api/hotel/full-booking/1");
      expect(res.status).toBe(200);
      expect(res.body.company_name).toBe("Orbit Corp");
    });

    test("adds pax information", async () => {
      const res = await api().post("/api/hotel/pax/1").send({
        adults: 3,
        children: 1,
        mealPlan: "AP",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/pax/i);
    });

    test("adds room tariff", async () => {
      const res = await api().post("/api/hotel/room-tariff/1").send({
        roomNumber: "102",
        date: "2026-03-27",
        quantity: 1,
        tariff: 2400,
        gstPercent: 120,
        total: 2520,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/tariff/i);
    });

    test("rejects room tariff without room number", async () => {
      const res = await api().post("/api/hotel/room-tariff/1").send({
        tariff: 2400,
      });

      expect(res.status).toBe(500);
    });

    test("adds advance payment and payment history", async () => {
      const res = await api().post("/api/hotel/advance/1").send({
        amount: 300,
        discount: 25,
        paymentMode: "UPI",
      });

      expect(res.status).toBe(200);

      const rows = await runQuery(
        "SELECT COUNT(*) AS c FROM payment_history WHERE booking_id = 1",
      );
      expect(Number(rows[0]?.c || 0)).toBeGreaterThanOrEqual(2);
    });

    test("returns payment history rows", async () => {
      const res = await api().get("/api/hotel/payment-history/1");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("guest_name");
    });
  });

  describe("booking list and life-cycle", () => {
    test("returns active bookings in all-bookings", async () => {
      const res = await api().get("/api/hotel/all-bookings");
      expect(res.status).toBe(200);
      expect(res.body.some((row) => row.bookingId === 1)).toBe(true);
      expect(res.body.some((row) => row.bookingId === 2)).toBe(false);
    });

    test("returns full booking details", async () => {
      const res = await api().get("/api/hotel/full-booking/1");
      expect(res.status).toBe(200);
      expect(res.body.bookingId).toBe(1);
      expect(Array.isArray(res.body.rooms)).toBe(true);
    });

    test("updates full booking", async () => {
      const res = await api().put("/api/hotel/full-booking/1").send({
        guest_name: "John Carter",
        mobile: "9990001111",
        company_name: "Acme Travels Updated",
        paidAmount: 650,
        rooms: [
          {
            room_number: "101",
            tariff: 2200,
            gst: 110,
            total: 2310,
            adults: 2,
            children: 1,
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    test("checks in booking", async () => {
      const res = await api().put("/api/hotel/check-in/1").send({});
      expect(res.status).toBe(200);

      const rows = await runQuery("SELECT booking_status FROM guests WHERE id = 1");
      expect(rows[0].booking_status).toBe("Checked In");
    });

    test("checks out booking", async () => {
      await api().put("/api/hotel/check-in/1").send({});
      const res = await api().put("/api/hotel/check-out/1").send({});
      expect(res.status).toBe(200);

      const rows = await runQuery("SELECT booking_status FROM guests WHERE id = 1");
      expect(rows[0].booking_status).toBe("Checked Out");
    });

    test("returns 404 when checking in missing booking", async () => {
      const res = await api().put("/api/hotel/check-in/999").send({});
      expect(res.status).toBe(404);
    });

    test("requires cancellation reason", async () => {
      const res = await api().put("/api/hotel/cancel/3").send({});
      expect(res.status).toBe(400);
    });

    test("blocks cancellation for checked-in booking", async () => {
      await api().put("/api/hotel/check-in/1").send({});
      const res = await api().put("/api/hotel/cancel/1").send({
        reason: "Guest request",
      });

      expect(res.status).toBe(400);
    });

    test("cancels confirmed booking", async () => {
      const res = await api().put("/api/hotel/cancel/3").send({
        reason: "Guest request",
      });

      expect(res.status).toBe(200);
      const rows = await runQuery("SELECT booking_status, cancel_reason FROM guests WHERE id = 3");
      expect(rows[0].booking_status).toBe("Cancelled");
      expect(rows[0].cancel_reason).toBe("Guest request");
    });

    test("returns checked-out rows in booking history", async () => {
      const res = await api().get("/api/hotel/booking-history");
      expect(res.status).toBe(200);
      expect(res.body.every((row) => row.booking_status === "Checked Out")).toBe(true);
    });
  });

  describe("folio endpoints", () => {
    test("returns folio entries by booking", async () => {
      const res = await api().get("/api/hotel/folio/1");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
    });

    test("validates folio booking id", async () => {
      const res = await api().get("/api/hotel/folio/abc");
      expect(res.status).toBe(400);
    });

    test("adds folio entry", async () => {
      const res = await api().post("/api/hotel/folio/1").send({
        entry_type: "Extra Charge",
        category: "Spa",
        description: "Spa access",
        amount: 350,
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/added/i);
    });

    test.each([
      [{ amount: 200 }, 400],
      [{ description: "Missing amount" }, 400],
      [{ description: "Negative", amount: -1 }, 400],
    ])("validates folio add payload %#", async (payload, expectedStatus) => {
      const res = await api().post("/api/hotel/folio/1").send(payload);
      expect(res.status).toBe(expectedStatus);
    });

    test("deletes folio entry", async () => {
      const res = await api().delete("/api/hotel/folio/entry/1");
      expect(res.status).toBe(200);
      const rows = await runQuery("SELECT COUNT(*) AS c FROM hotel_folio_entries WHERE id = 1");
      expect(Number(rows[0]?.c || 0)).toBe(0);
    });

    test("returns folio totals", async () => {
      const res = await api().get("/api/hotel/folio/1/totals");
      expect(res.status).toBe(200);
      expect(res.body.charges).toBe(200);
      expect(res.body.discounts).toBe(50);
      expect(res.body.payments).toBe(100);
      expect(res.body.refunds).toBe(0);
      expect(res.body.netBalance).toBe(50);
    });

    test("validates folio totals booking id", async () => {
      const res = await api().get("/api/hotel/folio/xyz/totals");
      expect(res.status).toBe(400);
    });
  });
});
