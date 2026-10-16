import { jest } from "@jest/globals";
import { frontendSeed } from "./fixtures/frontendSeed.js";

const apiMock = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.unstable_mockModule("../src/api.js", () => ({
  default: apiMock,
}));

const { housekeepingService } = await import("../src/services/housekeepingService.js");
const { roomService } = await import("../src/services/roomService.js");
const { userService } = await import("../src/services/userService.js");
const {
  createInventoryMasterRecord,
  deleteInventoryMasterRecord,
  fetchInventoryMasterRecord,
  fetchInventoryMasterRecords,
  fetchInventoryMasterSections,
  updateInventoryMasterRecord,
} = await import("../src/services/inventoryMastersService.js");
const {
  applyRecipeConsumption,
  deleteRecipeRow,
  fetchConsumptionLog,
  fetchRecipeCatalogue,
  fetchRecipeForMenuItem,
  fetchRecipeInventoryItems,
  fetchRecipeMenuItems,
  previewRecipeConsumption,
  saveRecipe,
  updateRecipeRow,
} = await import("../src/services/menuRecipeService.js");
const { fetchBookingWizard } = await import("../src/components/Hotel/bookingWizardApi.js");

describe("frontend service coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("housekeepingService normalizes roomNumber during create and updates status helpers", async () => {
    apiMock.post.mockResolvedValueOnce({ data: { id: frontendSeed.housekeeping.room.id } });
    apiMock.put
      .mockResolvedValueOnce({ data: { updated: true } })
      .mockResolvedValueOnce({ data: { updated: true } });

    await expect(housekeepingService.createRoom(frontendSeed.housekeeping.room)).resolves.toEqual({
      id: frontendSeed.housekeeping.room.id,
    });
    await housekeepingService.updateRoomStatus(frontendSeed.housekeeping.room.id, "Clean");
    await housekeepingService.updateRoomAssignee(frontendSeed.housekeeping.room.id, "Amit");

    expect(apiMock.post).toHaveBeenCalledWith("/housekeeping", expect.objectContaining({
      roomNumber: frontendSeed.housekeeping.room.roomNumber,
    }));
    expect(apiMock.put).toHaveBeenNthCalledWith(
      1,
      `/housekeeping/status/${frontendSeed.housekeeping.room.id}`,
      { status: "Clean" },
    );
    expect(apiMock.put).toHaveBeenNthCalledWith(
      2,
      `/housekeeping/assignee/${frontendSeed.housekeeping.room.id}`,
      { assignee: "Amit" },
    );
  });

  test("roomService uses the expected room-service endpoints", async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: [{ number: "101" }] })
      .mockResolvedValueOnce({ data: [{ name: "Coffee" }] });
    apiMock.post
      .mockResolvedValueOnce({ data: { id: 1 } })
      .mockResolvedValueOnce({ data: { id: 2 } })
      .mockResolvedValueOnce({ data: { orderId: 5 } });

    await expect(roomService.getRooms()).resolves.toEqual([{ number: "101" }]);
    await expect(roomService.addRoom(101)).resolves.toEqual({ id: 1 });
    await expect(roomService.addMenuItem({ name: "Coffee" })).resolves.toEqual({ id: 2 });
    await expect(roomService.addOrderItems("101", [{ name: "Coffee", quantity: 1 }])).resolves.toEqual({
      orderId: 5,
    });
    await expect(roomService.getMenu()).resolves.toEqual([{ name: "Coffee" }]);
  });

  test("userService fetches all users", async () => {
    apiMock.get.mockResolvedValue({ data: [{ id: 1, email: frontendSeed.auth.email }] });
    await expect(userService.getAllUsers()).resolves.toEqual([{ id: 1, email: frontendSeed.auth.email }]);
    expect(apiMock.get).toHaveBeenCalledWith("/users");
  });

  test("inventory master services cover list, read, create, update, and delete flows", async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: ["suppliers", "vendors"] })
      .mockResolvedValueOnce({ data: [frontendSeed.inventory.record] })
      .mockResolvedValueOnce({ data: frontendSeed.inventory.record });
    apiMock.post.mockResolvedValueOnce({ data: { id: frontendSeed.inventory.record.id } });
    apiMock.put.mockResolvedValueOnce({ data: { updated: true } });
    apiMock.delete.mockResolvedValueOnce({ data: { deleted: true } });

    await expect(fetchInventoryMasterSections()).resolves.toEqual(["suppliers", "vendors"]);
    await expect(fetchInventoryMasterRecords(frontendSeed.inventory.sectionKey)).resolves.toEqual([
      frontendSeed.inventory.record,
    ]);
    await expect(
      fetchInventoryMasterRecord(frontendSeed.inventory.sectionKey, frontendSeed.inventory.record.id),
    ).resolves.toEqual(frontendSeed.inventory.record);
    await expect(
      createInventoryMasterRecord(frontendSeed.inventory.sectionKey, frontendSeed.inventory.record),
    ).resolves.toEqual({ id: frontendSeed.inventory.record.id });
    await expect(
      updateInventoryMasterRecord(frontendSeed.inventory.sectionKey, frontendSeed.inventory.record.id, {
        status: "inactive",
      }),
    ).resolves.toEqual({ updated: true });
    await expect(
      deleteInventoryMasterRecord(frontendSeed.inventory.sectionKey, frontendSeed.inventory.record.id),
    ).resolves.toEqual({ deleted: true });
  });

  test("menu recipe services normalize array-based endpoints and payload mutations", async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: [frontendSeed.restaurant.menuItem] })
      .mockResolvedValueOnce({ data: [{ id: 4, name: "Rice" }] })
      .mockResolvedValueOnce({ data: [{ id: 2, menuItemId: frontendSeed.menuRecipes.menuItemId }] })
      .mockResolvedValueOnce({ data: [{ id: frontendSeed.menuRecipes.recipeRowId }] })
      .mockResolvedValueOnce({ data: [{ id: 1, reference: "log-1" }] });
    apiMock.post
      .mockResolvedValueOnce({ data: { saved: true } })
      .mockResolvedValueOnce({ data: [{ preview: true }] })
      .mockResolvedValueOnce({ data: { applied: true } });
    apiMock.put.mockResolvedValueOnce({ data: { updated: true } });
    apiMock.delete.mockResolvedValueOnce({ data: { deleted: true } });

    await expect(fetchRecipeMenuItems()).resolves.toEqual([frontendSeed.restaurant.menuItem]);
    await expect(fetchRecipeInventoryItems()).resolves.toEqual([{ id: 4, name: "Rice" }]);
    await expect(fetchRecipeCatalogue()).resolves.toEqual([
      { id: 2, menuItemId: frontendSeed.menuRecipes.menuItemId },
    ]);
    await expect(fetchRecipeForMenuItem(frontendSeed.menuRecipes.menuItemId)).resolves.toEqual([
      { id: frontendSeed.menuRecipes.recipeRowId },
    ]);
    await expect(
      saveRecipe(frontendSeed.menuRecipes.menuItemId, [frontendSeed.menuRecipes.ingredient]),
    ).resolves.toEqual({ saved: true });
    await expect(updateRecipeRow(frontendSeed.menuRecipes.recipeRowId, { quantity: 3 })).resolves.toEqual({
      updated: true,
    });
    await expect(deleteRecipeRow(frontendSeed.menuRecipes.recipeRowId)).resolves.toEqual({ deleted: true });
    await expect(previewRecipeConsumption({ covers: 25 })).resolves.toEqual([{ preview: true }]);
    await expect(applyRecipeConsumption({ covers: 25 })).resolves.toEqual({ applied: true });
    await expect(fetchConsumptionLog(50)).resolves.toEqual([{ id: 1, reference: "log-1" }]);
  });

  test("booking wizard API skips empty booking ids and fetches backend data when id exists", async () => {
    apiMock.get.mockResolvedValueOnce({ data: { id: frontendSeed.hotel.bookingId } });

    await expect(fetchBookingWizard("")).resolves.toBeNull();
    await expect(fetchBookingWizard(frontendSeed.hotel.bookingId)).resolves.toEqual({
      id: frontendSeed.hotel.bookingId,
    });

    expect(apiMock.get).toHaveBeenCalledWith(`/hotel/wizard/${frontendSeed.hotel.bookingId}`);
  });
});
