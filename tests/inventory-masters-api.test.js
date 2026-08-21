const { api, authHeader } = require("./helpers/testRequest");
const { ensureTestSchema, db } = require("./helpers/testDb");

jest.setTimeout(60000);

describe("Inventory masters APIs", () => {
  const adminUser = { id: 1, email: "admin@test.com", role: "admin" };
  const managerUser = { id: 2, email: "manager@test.com", role: "manager" };
  const kitchenUser = { id: 99, email: "kitchen@test.com", role: "kitchen" };

  beforeEach(async () => {
    await ensureTestSchema();
    const connection = await db.promise().getConnection();
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      await connection.query("TRUNCATE TABLE inventory_ingredients");
      await connection.query("TRUNCATE TABLE inventory_vendors");
      await connection.query("TRUNCATE TABLE inventory_units");
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } finally {
      connection.release();
    }
  });

  test("creates, lists, updates, fetches, and deletes vendor master records", async () => {
    const createRes = await api()
      .post("/api/inventory-masters/vendors")
      .set(authHeader(adminUser))
      .send({
        name: "Fresh Farm Supply",
        contact: "Ravi",
        phone: "9876543210",
        email: "vendor@test.com",
        city: "Varanasi",
        gstin: "09ABCDE1234F1Z5",
        status: "Active",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.record).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: "Fresh Farm Supply",
        city: "Varanasi",
      }),
    );

    const listRes = await api()
      .get("/api/inventory-masters/vendors")
      .set(authHeader(kitchenUser));

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Fresh Farm Supply",
          gstin: "09ABCDE1234F1Z5",
        }),
      ]),
    );

    const vendorId = createRes.body.record.id;

    const getRes = await api()
      .get(`/api/inventory-masters/vendors/${vendorId}`)
      .set(authHeader(managerUser));

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(
      expect.objectContaining({
        id: vendorId,
        contact: "Ravi",
      }),
    );

    const updateRes = await api()
      .put(`/api/inventory-masters/vendors/${vendorId}`)
      .set(authHeader(managerUser))
      .send({
        name: "Fresh Farm Supply Updated",
        contact: "Amit",
        phone: "9988776655",
        email: "updated@test.com",
        city: "Mirzapur",
        gstin: "09ABCDE1234F1Z5",
        status: "On Hold",
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.record).toEqual(
      expect.objectContaining({
        name: "Fresh Farm Supply Updated",
        status: "On Hold",
      }),
    );

    const deleteRes = await api()
      .delete(`/api/inventory-masters/vendors/${vendorId}`)
      .set(authHeader(adminUser));

    expect(deleteRes.status).toBe(200);
  });

  test("lists supported inventory master sections", async () => {
    const res = await api()
      .get("/api/inventory-masters/sections")
      .set(authHeader(managerUser));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "vendors", table: "inventory_vendors" }),
        expect.objectContaining({ key: "purchase-services", table: "inventory_purchase_services" }),
      ]),
    );
  });

  test("creates and lists ingredient records with reserved field aliases", async () => {
    const createRes = await api()
      .post("/api/inventory-masters/ingredients")
      .set(authHeader(adminUser))
      .send({
        name: "Paneer",
        group: "Dairy",
        unit: "Kg",
        status: "Active",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.record).toEqual(
      expect.objectContaining({
        name: "Paneer",
        group: "Dairy",
        unit: "Kg",
      }),
    );

    const listRes = await api()
      .get("/api/inventory-masters/ingredients")
      .set(authHeader(kitchenUser));

    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Paneer",
          group: "Dairy",
          status: "Active",
        }),
      ]),
    );
  });

  test("enforces permissions and validation for inventory masters", async () => {
    const forbiddenRes = await api()
      .post("/api/inventory-masters/units")
      .set(authHeader(kitchenUser))
      .send({
        name: "Kilogram",
        shortName: "kg",
        type: "Weight",
      });

    expect(forbiddenRes.status).toBe(403);

    const validationRes = await api()
      .post("/api/inventory-masters/units")
      .set(authHeader(adminUser))
      .send({
        name: "",
        shortName: "",
        type: "Weight",
      });

    expect(validationRes.status).toBe(400);
    expect(validationRes.body.message).toMatch(/required/i);
  });
});
