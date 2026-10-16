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

const { restaurantService } = await import("../src/services/restaurantService.js");

describe("restaurantService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads tables and menu from backend API", async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: [frontendSeed.restaurant.table] })
      .mockResolvedValueOnce({ data: [frontendSeed.restaurant.menuItem] });

    await expect(restaurantService.getTables()).resolves.toEqual([frontendSeed.restaurant.table]);
    await expect(restaurantService.getMenu(frontendSeed.restaurant.table.number)).resolves.toEqual([
      frontendSeed.restaurant.menuItem,
    ]);

    expect(apiMock.get).toHaveBeenNthCalledWith(1, "/restaurant/tables");
    expect(apiMock.get).toHaveBeenNthCalledWith(2, "/restaurant/menu", {
      params: { tableNumber: frontendSeed.restaurant.table.number },
    });
  });

  test("passes FormData menu payload without overriding multipart headers", async () => {
    apiMock.post.mockResolvedValue({ data: { ok: true } });
    const payload = new FormData();
    payload.append("name", frontendSeed.restaurant.menuItem.name);

    await expect(restaurantService.addMenuItem(payload)).resolves.toEqual({ ok: true });
    expect(apiMock.post).toHaveBeenCalledWith("/restaurant/menu", payload);
  });

  test("creates order by posting each item and returns latest order id", async () => {
    apiMock.post
      .mockResolvedValueOnce({ data: { orderId: 61 } })
      .mockResolvedValueOnce({ data: { orderId: 61 } });

    await expect(
      restaurantService.createOrder(frontendSeed.restaurant.table.number, frontendSeed.restaurant.orderItems),
    ).resolves.toEqual({ orderId: 61 });

    expect(apiMock.post).toHaveBeenNthCalledWith(1, "/restaurant/order/add", {
      tableNumber: frontendSeed.restaurant.table.number,
      item: frontendSeed.restaurant.orderItems[0],
    });
    expect(apiMock.post).toHaveBeenNthCalledWith(2, "/restaurant/order/add", {
      tableNumber: frontendSeed.restaurant.table.number,
      item: frontendSeed.restaurant.orderItems[1],
    });
  });

  test("pays bill against bill-specific endpoint when billId exists", async () => {
    apiMock.post.mockResolvedValue({ data: { message: "paid" } });

    await expect(
      restaurantService.payBill({ billId: frontendSeed.restaurant.bill.id, mode: "UPI" }),
    ).resolves.toEqual({ message: "paid" });

    expect(apiMock.post).toHaveBeenCalledWith(
      `/restaurant/bill/${frontendSeed.restaurant.bill.id}/pay`,
      { billId: frontendSeed.restaurant.bill.id, mode: "UPI" },
    );
  });

  test("falls back to generic pay endpoint when billId is absent", async () => {
    apiMock.post.mockResolvedValue({ data: { message: "paid" } });

   
    await expect(restaurantService.payBill({ mode: "Cash" })).resolves.toEqual({ message: "paid" });

    expect(apiMock.post).toHaveBeenCalledWith("/restaurant/bill/pay", { mode: "Cash" });
  });

  test("returns empty arrays for optional analytics endpoints when API fails", async () => {
    apiMock.get.mockRejectedValue(new Error("network"));

    await expect(restaurantService.getWaiterPerformance()).resolves.toEqual([]);
    await expect(restaurantService.getItemActionRequests()).resolves.toEqual([]);
  });
});
