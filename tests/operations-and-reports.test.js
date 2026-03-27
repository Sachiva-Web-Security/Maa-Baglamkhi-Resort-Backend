const { api, authHeader } = require("./helpers/testRequest");
const { resetAndSeedDatabase } = require("./helpers/testDb");

describe("Operations, Dashboard, Reports, and Audit APIs", () => {
  let seed;

  beforeEach(async () => {
    seed = await resetAndSeedDatabase();
  });

  describe("assignments", () => {
    test("lists assignments", async () => {
      const res = await api().get("/api/assignments");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    test("returns assignment stats", async () => {
      const res = await api().get("/api/assignments/stats");
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.completed).toBeGreaterThanOrEqual(1);
    });

    test("creates assignment", async () => {
      const res = await api().post("/api/assignments").send({
        staffName: "Housekeeping User",
        roomNumber: "201",
        task: "Dust furniture",
        assignedBy: "Manager User",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("updates assignment", async () => {
      const res = await api().put("/api/assignments/1").send({
        status: "Completed",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    test("rejects empty assignment update", async () => {
      const res = await api().put("/api/assignments/1").send({});
      expect(res.status).toBe(400);
    });

    test("deletes assignment", async () => {
      const res = await api().delete("/api/assignments/1");
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  describe("housekeeping", () => {
    test("lists housekeeping rooms", async () => {
      const res = await api().get("/api/housekeeping");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns housekeeping logs", async () => {
      const res = await api().get("/api/housekeeping/logs");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("creates housekeeping room entry", async () => {
      const res = await api().post("/api/housekeeping").send({
        roomNo: "501",
        status: "Vacant Dirty",
        assignee: "Housekeeping User",
        priority: "High",
        notes: "Fresh setup",
      });

      expect(res.status).toBe(200);
      expect(res.body.updatedExisting).toBe(false);
    });

    test("writes housekeeping log on status update", async () => {
      const updateRes = await api().put("/api/housekeeping/status/2").send({
        status: "Cleaning In Progress",
      });

      expect(updateRes.status).toBe(200);

      const logsRes = await api().get("/api/housekeeping/logs");
      expect(logsRes.status).toBe(200);
      expect(
        logsRes.body.some(
          (row) => row.roomNo === "102" && row.newStatus === "Cleaning In Progress",
        ),
      ).toBe(true);
    });

    test("updates housekeeping room", async () => {
      const res = await api().put("/api/housekeeping/1").send({
        status: "Vacant Clean",
        assignee: "Housekeeping User",
        priority: "Normal",
        notes: "Done",
      });

      expect(res.status).toBe(200);
    });

    test("updates housekeeping status", async () => {
      const res = await api().put("/api/housekeeping/status/2").send({
        status: "Cleaning In Progress",
      });

      expect(res.status).toBe(200);
    });

    test("updates housekeeping assignee", async () => {
      const res = await api().put("/api/housekeeping/assignee/2").send({
        assignee: "Housekeeping User",
      });

      expect(res.status).toBe(200);
    });

    test("deletes housekeeping room", async () => {
      await api().post("/api/housekeeping").send({
        roomNo: "601",
        status: "Vacant Dirty",
      });

      const res = await api().delete("/api/housekeeping/601");
      expect(res.status).toBe(200);
    });
  });

  describe("accounts and attendance", () => {
    test("lists account transactions", async () => {
      const res = await api().get("/api/accounts/transactions");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns accounts summary", async () => {
      const res = await api().get("/api/accounts/summary");
      expect(res.status).toBe(200);
      expect(res.body.income).toBeGreaterThan(0);
      expect(res.body.expense).toBeGreaterThanOrEqual(0);
    });

    test.each([
      ["/api/accounts/income", { description: "Missing", amount: 100 }, 400],
      ["/api/accounts/expense", { description: "Missing", amount: 100 }, 400],
    ])("validates income/expense payload %#", async (url, payload, status) => {
      const res = await api().post(url).send(payload);
      expect(res.status).toBe(status);
    });

    test("adds income", async () => {
      const res = await api().post("/api/accounts/income").send({
        date: "2026-03-27",
        description: "Counter sale",
        amount: 999,
        paymentMode: "Cash",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });

    test("adds expense", async () => {
      const res = await api().post("/api/accounts/expense").send({
        date: "2026-03-27",
        description: "Stationery",
        amount: 199,
        paymentMode: "Cash",
      });

      expect(res.status).toBe(200);
    });

    test("returns extended summary", async () => {
      const res = await api().get("/api/accounts/extended-summary");
      expect(res.status).toBe(200);
    });

    test("adds and lists bank ledger entry", async () => {
      const createRes = await api().post("/api/accounts/bank-ledger").send({
        entryDate: "2026-03-27",
        bankName: "SBI",
        referenceNo: "REF-1",
        description: "Deposit",
        debit: 0,
        credit: 5000,
      });
      expect(createRes.status).toBe(200);

      const listRes = await api().get("/api/accounts/bank-ledger");
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
    });

    test("adds and lists petty cash", async () => {
      const createRes = await api().post("/api/accounts/petty-cash").send({
        entryDate: "2026-03-27",
        entryType: "Expense",
        category: "Cleaning",
        description: "Mop purchase",
        amount: 150,
      });
      expect(createRes.status).toBe(200);

      const listRes = await api().get("/api/accounts/petty-cash");
      expect(listRes.status).toBe(200);
    });

    test("returns attendance for date", async () => {
      const res = await api().get("/api/attendance?date=2026-03-27");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("requires attendance date query", async () => {
      const res = await api().get("/api/attendance");
      expect(res.status).toBe(400);
    });

    test("creates manual attendance record", async () => {
      const res = await api().post("/api/attendance").send({
        date: "2026-03-28",
        name: "Manager User",
        role: "manager",
        department: "Management",
        checkIn: "09:00",
        checkOut: "18:00",
        status: "Present",
        method: "Manual",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeTruthy();
    });
  });

  describe("dashboard and reports", () => {
    test("returns dashboard metrics", async () => {
      const res = await api().get("/api/dashboard/metrics");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalRooms");
      expect(res.body).toHaveProperty("occupiedRooms");
    });

    test("returns dashboard charts", async () => {
      const res = await api().get("/api/dashboard/charts");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("monthlyRevenue");
      expect(res.body).toHaveProperty("roomOccupancy");
    });

    test("returns report summary", async () => {
      const res = await api().get("/api/reports/summary");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalRooms");
    });

    test("requires report type", async () => {
      const res = await api().get("/api/reports/data");
      expect(res.status).toBe(400);
    });

    test.each(["room", "banquet", "restaurant", "housekeeping", "accounts", "all-bills"])(
      "returns report data for type %s",
      async (type) => {
        const res = await api().get(`/api/reports/data?type=${type}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      },
    );

    test("returns daywise report", async () => {
      const res = await api().get("/api/report/daywise?start=2026-03-01&end=2026-03-31");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns item consumption", async () => {
      const res = await api().get("/api/report/items");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns daywise food report", async () => {
      await api().get("/api/invoice/1");
      const res = await api().get("/api/report/daywise-food?startDate=2026-03-01&endDate=2026-03-31");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("returns daily room food report", async () => {
      const res = await api().get("/api/report/daily-room-food?date=2026-03-27");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("audit logs role access", () => {
    test("blocks unauthenticated audit log access", async () => {
      const res = await api().get("/api/audit-logs");
      expect(res.status).toBe(401);
    });

    test("blocks receptionist audit log access", async () => {
      const res = await api()
        .get("/api/audit-logs")
        .set(authHeader(seed.users.receptionist));
      expect(res.status).toBe(403);
    });

    test("allows admin audit log access", async () => {
      await api().get("/api/dashboard/metrics");
      const res = await api()
        .get("/api/audit-logs")
        .set(authHeader(seed.users.admin));
      expect(res.status).toBe(200);
    });

    test("allows manager audit log access", async () => {
      const res = await api()
        .get("/api/audit-logs")
        .set(authHeader(seed.users.manager));
      expect(res.status).toBe(200);
    });
  });
});
