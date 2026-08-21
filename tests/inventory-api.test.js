const { api, authHeader } = require("./helpers/testRequest");
const { resetAndSeedDatabase } = require("./helpers/testDb");

jest.setTimeout(60000);

describe("Inventory APIs", () => {
  const kitchenUser = {
    id: 99,
    email: "kitchen@test.com",
    role: "kitchen",
  };

  const receptionistUser = {
    id: 100,
    email: "reception@test.com",
    role: "receptionist",
  };

  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  test("creates, lists, updates, fetches, and deletes inventory items", async () => {
    const createRes = await api()
      .post("/api/inventory")
      .set(authHeader({ id: 1, email: "admin@test.com", role: "admin" }))
      .send({
        name: "Basmati Rice",
        category: "Grains",
        stock: 25,
        unit: "kg",
        price: 85,
        reorderPoint: 10,
        expiry: "2026-04-30",
        branch: "Main Store",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();

    const listRes = await api()
      .get("/api/inventory")
      .set(authHeader(kitchenUser));

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body[0]).toEqual(
      expect.objectContaining({
        name: "Basmati Rice",
        category: "Grains",
        stock: "25.00",
        unit: "kg",
        reorderPoint: "10.00",
        branch: "Main Store",
      })
    );

    const itemId = createRes.body.id;

    const getRes = await api()
      .get(`/api/inventory/${itemId}`)
      .set(authHeader(kitchenUser));

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(
      expect.objectContaining({
        id: itemId,
        name: "Basmati Rice",
        expiry: "2026-04-30",
      })
    );

    const updateRes = await api()
      .put(`/api/inventory/${itemId}`)
      .set(authHeader({ id: 2, email: "manager@test.com", role: "manager" }))
      .send({
        name: "Basmati Rice Premium",
        category: "Grains",
        stock: 8,
        unit: "kg",
        price: 90,
        reorderPoint: 10,
        expiry: "2026-04-25",
        branch: "Main Store",
      });

    expect(updateRes.status).toBe(200);

    const lowStockRes = await api()
      .get("/api/inventory/alerts/low-stock")
      .set(authHeader(kitchenUser));

    expect(lowStockRes.status).toBe(200);
    expect(lowStockRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: itemId,
          name: "Basmati Rice Premium",
        }),
      ])
    );

    const expiringRes = await api()
      .get("/api/inventory/alerts/expiring?days=30")
      .set(authHeader(kitchenUser));

    expect(expiringRes.status).toBe(200);
    expect(expiringRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: itemId,
          name: "Basmati Rice Premium",
          expiry: "2026-04-25",
        }),
      ])
    );

    const deleteRes = await api()
      .delete(`/api/inventory/${itemId}`)
      .set(authHeader({ id: 1, email: "admin@test.com", role: "admin" }));

    expect(deleteRes.status).toBe(200);
  });

  test("enforces inventory route permissions", async () => {
    const createRes = await api()
      .post("/api/inventory")
      .set(authHeader(kitchenUser))
      .send({
        name: "Unauthorized Item",
        category: "Misc",
        stock: 5,
        unit: "pcs",
        price: 20,
        branch: "Store",
      });

    expect(createRes.status).toBe(403);

    const readRes = await api()
      .get("/api/inventory")
      .set(authHeader(receptionistUser));

    expect(readRes.status).toBe(200);
  });

  test("logs and lists inventory waste entries", async () => {
    const createRes = await api()
      .post("/api/inventory/waste")
      .set(authHeader(kitchenUser))
      .send({
        itemName: "Milk",
        quantity: 3,
        unit: "ltr",
        reason: "Expired",
        store: "Cold Store",
        remarks: "Found spoiled during morning check",
        date: "2026-03-28",
      });

    expect(createRes.status).toBe(201);

    const listRes = await api()
      .get("/api/inventory/waste")
      .set(authHeader({ id: 2, email: "manager@test.com", role: "manager" }));

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemName: "Milk",
          reason: "Expired",
          store: "Cold Store",
        }),
      ])
    );
  });

  test("creates, updates, lists, and deletes purchase orders", async () => {
    const createRes = await api()
      .post("/api/inventory/purchase-orders")
      .set(authHeader({ id: 2, email: "manager@test.com", role: "manager" }))
      .send({
        poNumber: "PO-INV-001",
        vendor: "Fresh Farm Supply",
        itemName: "Paneer",
        quantity: 20,
        unit: "kg",
        rate: 240,
        expectedDate: "2026-04-02",
        status: "Draft",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();

    const listRes = await api()
      .get("/api/inventory/purchase-orders")
      .set(authHeader(kitchenUser));

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          poNumber: "PO-INV-001",
          itemName: "Paneer",
          status: "Draft",
        }),
      ])
    );

    const updateRes = await api()
      .put(`/api/inventory/purchase-orders/${createRes.body.id}`)
      .set(authHeader({ id: 1, email: "admin@test.com", role: "admin" }))
      .send({
        poNumber: "PO-INV-001",
        vendor: "Fresh Farm Supply",
        itemName: "Paneer",
        quantity: 24,
        unit: "kg",
        rate: 245,
        expectedDate: "2026-04-03",
        status: "Sent",
      });

    expect(updateRes.status).toBe(200);

    const deleteRes = await api()
      .delete(`/api/inventory/purchase-orders/${createRes.body.id}`)
      .set(authHeader({ id: 2, email: "manager@test.com", role: "manager" }));

    expect(deleteRes.status).toBe(200);
  });

  test("records transfers and exposes transfer history", async () => {
    const createRes = await api()
      .post("/api/inventory/transfers")
      .set(authHeader(kitchenUser))
      .send({
        itemName: "Soft Drinks",
        fromStore: "Main Store",
        toStore: "Bar Counter",
        quantity: 24,
        unit: "pcs",
        approvedBy: "Manager",
        date: "2026-03-29",
        notes: "Weekend event stock move",
      });

    expect(createRes.status).toBe(201);

    const listRes = await api()
      .get("/api/inventory/transfers")
      .set(authHeader({ id: 1, email: "admin@test.com", role: "admin" }));

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemName: "Soft Drinks",
          fromStore: "Main Store",
          toStore: "Bar Counter",
        }),
      ])
    );
  });

  test("submits and lists stock audit entries", async () => {
    const itemCreateRes = await api()
      .post("/api/inventory")
      .set(authHeader({ id: 1, email: "admin@test.com", role: "admin" }))
      .send({
        name: "Cooking Oil",
        category: "Essentials",
        stock: 12,
        unit: "ltr",
        price: 130,
        reorderPoint: 5,
        branch: "Main Store",
      });

    const auditRes = await api()
      .post("/api/inventory/audit")
      .set(authHeader({ id: 2, email: "manager@test.com", role: "manager" }))
      .send({
        entries: [
          {
            itemId: itemCreateRes.body.id,
            itemName: "Cooking Oil",
            systemStock: 12,
            physicalStock: 10,
            variance: -2,
            unit: "ltr",
            remarks: "Two litres missing",
          },
        ],
      });

    expect(auditRes.status).toBe(200);

    const reportRes = await api()
      .get("/api/inventory/audit/report")
      .set(authHeader(kitchenUser));

    expect(reportRes.status).toBe(200);
    expect(reportRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemName: "Cooking Oil",
          physicalStock: "10.00",
          variance: "-2.00",
        }),
      ])
    );
  });
});
