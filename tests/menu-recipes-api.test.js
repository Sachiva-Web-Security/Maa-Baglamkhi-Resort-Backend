const db = require("../config/db");
const { api, authHeader } = require("./helpers/testRequest");
const { ensureTestSchema, clearDatabase } = require("./helpers/testDb");

jest.setTimeout(60000);

describe("Menu recipe APIs", () => {
  const adminUser = { id: 1, email: "admin@test.com", role: "admin" };
  const managerUser = { id: 2, email: "manager@test.com", role: "manager" };
  const kitchenUser = { id: 99, email: "kitchen@test.com", role: "kitchen" };

  let menuItemId;
  let inventoryItemId;

  beforeEach(async () => {
    await ensureTestSchema();
    await clearDatabase();

    const [inventoryInsert] = await db.promise().query(
      `
        INSERT INTO inventory
          (name, category, stock, unit, price, reorder_point, branch)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ["Paneer", "Dairy", 10, "kg", 260, 2, "Main Store"],
    );
    inventoryItemId = inventoryInsert.insertId;

    const [menuInsert] = await db.promise().query(
      `
        INSERT INTO menu_items
          (name, price, category, description, food_type, availability_status, tax)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ["Paneer Butter Masala", 320, "Main Course Veg", "Rich curry", "Veg", "Available", 5],
    );
    menuItemId = menuInsert.insertId;
  });

  test("lists menu items and inventory items for recipe builder", async () => {
    const menuRes = await api()
      .get("/api/menu-recipes/menu-items")
      .set(authHeader(managerUser));

    expect(menuRes.status).toBe(200);
    expect(menuRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: menuItemId,
          name: "Paneer Butter Masala",
        }),
      ]),
    );

    const inventoryRes = await api()
      .get("/api/menu-recipes/inventory-items")
      .set(authHeader(kitchenUser));

    expect(inventoryRes.status).toBe(200);
    expect(inventoryRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: inventoryItemId,
          name: "Paneer",
        }),
      ]),
    );
  });

  test("saves recipe rows, previews consumption, applies stock consumption, and returns logs", async () => {
    const saveRes = await api()
      .post(`/api/menu-recipes/menu/${menuItemId}`)
      .set(authHeader(adminUser))
      .send({
        ingredients: [
          {
            inventoryItemId,
            quantity: 0.25,
            unit: "kg",
            wastagePercent: 10,
            isOptional: false,
            notes: "Per plate recipe",
            sortOrder: 0,
          },
        ],
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          menuItemId,
          inventoryItemId,
        }),
      ]),
    );

    const recipeRes = await api()
      .get(`/api/menu-recipes/menu/${menuItemId}`)
      .set(authHeader(kitchenUser));

    expect(recipeRes.status).toBe(200);
    expect(recipeRes.body[0]).toEqual(
      expect.objectContaining({
        inventoryItemName: "Paneer",
      }),
    );

    const previewRes = await api()
      .post("/api/menu-recipes/preview-consumption")
      .set(authHeader(kitchenUser))
      .send({
        menuItemId,
        orderQuantity: 2,
      });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body[0]).toEqual(
      expect.objectContaining({
        inventoryItemId,
        requiredQuantity: 0.55,
        enoughStock: true,
      }),
    );

    const applyRes = await api()
      .post("/api/menu-recipes/apply-consumption")
      .set(authHeader(kitchenUser))
      .send({
        menuItemId,
        orderQuantity: 2,
        referenceType: "order",
        referenceId: "ORD-1001",
      });

    expect(applyRes.status).toBe(200);
    expect(applyRes.body.rows[0]).toEqual(
      expect.objectContaining({
        inventoryItemId,
        consumedQuantity: 0.55,
      }),
    );

    const [inventoryRows] = await db.promise().query(
      "SELECT stock FROM inventory WHERE id = ?",
      [inventoryItemId],
    );
    expect(Number(inventoryRows[0].stock)).toBeCloseTo(9.45, 2);

    const logRes = await api()
      .get("/api/menu-recipes/consumption-log?limit=10")
      .set(authHeader(managerUser));

    expect(logRes.status).toBe(200);
    expect(logRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          menuItemName: "Paneer Butter Masala",
          inventoryItemName: "Paneer",
          referenceType: "order",
          referenceId: "ORD-1001",
        }),
      ]),
    );
  });

  test("rejects invalid payloads and enforces access", async () => {
    const invalidRes = await api()
      .post(`/api/menu-recipes/menu/${menuItemId}`)
      .set(authHeader(adminUser))
      .send({
        ingredients: [],
      });

    expect(invalidRes.status).toBe(400);

    const forbiddenRes = await api()
      .post(`/api/menu-recipes/menu/${menuItemId}`)
      .set(authHeader(kitchenUser))
      .send({
        ingredients: [
          {
            inventoryItemId,
            quantity: 0.5,
            unit: "kg",
          },
        ],
      });

    expect(forbiddenRes.status).toBe(403);
  });
});
