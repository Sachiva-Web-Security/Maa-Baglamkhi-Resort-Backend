const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

describe("Payments API", () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  test("creates payment", async () => {
    const res = await api().post("/api/payment").send({
      table: "T1",
      total: 525,
      method: "Cash",
    });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
  });

  test("stores payment data correctly", async () => {
    await api().post("/api/payment").send({
      table: "T1",
      total: 525,
      method: "UPI",
    });

    const rows = await runQuery("SELECT * FROM payments WHERE tableNumber = 'T1' ORDER BY id DESC LIMIT 1");
    expect(Number(rows[0].total)).toBe(525);
    expect(rows[0].paymentMethod).toBe("UPI");
  });

  test("returns payment list", async () => {
    const res = await api().get("/api/payment");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test("returns payments in descending order", async () => {
    await api().post("/api/payment").send({
      table: "T1",
      total: 500,
      method: "Cash",
    });
    await api().post("/api/payment").send({
      table: "T1",
      total: 700,
      method: "Card",
    });

    const res = await api().get("/api/payment");
    expect(res.status).toBe(200);
    expect(Number(res.body[0].id)).toBeGreaterThan(Number(res.body[1].id));
  });

  test.each([
    [{ table: "T1", total: 0, method: "Cash" }, 200],
    [{ table: "T5", total: 9999, method: "Bank Transfer" }, 200],
    [{ table: null, total: 100, method: "Cash" }, 200],
  ])("handles current payment controller payload %#", async (payload, status) => {
    const res = await api().post("/api/payment").send(payload);
    expect(res.status).toBe(status);
  });

  test("captures multiple payment methods", async () => {
    const methods = ["Cash", "Card", "UPI", "Bank Transfer"];

    for (const method of methods) {
      const res = await api().post("/api/payment").send({
        table: `TB-${method}`,
        total: 123,
        method,
      });
      expect(res.status).toBe(200);
    }

    const rows = await runQuery("SELECT DISTINCT paymentMethod FROM payments");
    const savedMethods = rows.map((row) => row.paymentMethod);
    methods.forEach((method) => expect(savedMethods).toContain(method));
  });

  test("does not modify existing payment rows", async () => {
    const before = await runQuery("SELECT COUNT(*) AS c FROM payments");

    await api().post("/api/payment").send({
      table: "T1",
      total: 100,
      method: "Cash",
    });

    const after = await runQuery("SELECT COUNT(*) AS c FROM payments");
    expect(Number(after[0].c)).toBe(Number(before[0].c) + 1);
  });

  test("round-trips payment table and amount in response flow", async () => {
    const createRes = await api().post("/api/payment").send({
      table: "T8",
      total: 888,
      method: "Card",
    });

    expect(createRes.status).toBe(200);

    const listRes = await api().get("/api/payment");
    const payment = listRes.body.find((row) => Number(row.id) === Number(createRes.body.id));

    expect(payment.tableNumber).toBe("T8");
    expect(Number(payment.total)).toBe(888);
  });
});
