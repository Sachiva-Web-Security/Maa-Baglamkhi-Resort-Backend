const { api } = require("./helpers/testRequest");
const { resetAndSeedDatabase, runQuery } = require("./helpers/testDb");

describe("Room Inventory and Block APIs", () => {
  beforeEach(async () => {
    await resetAndSeedDatabase();
  });

  describe("room setup", () => {
    test("returns room setup grouped by category", async () => {
      const res = await api().get("/api/hotel/rooms/setup");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    test("includes roomDetails in setup", async () => {
      const res = await api().get("/api/hotel/rooms/setup");
      expect(res.status).toBe(200);
      expect(res.body[0]).toHaveProperty("roomDetails");
    });

    test("adds inventory room", async () => {
      const res = await api().post("/api/hotel/rooms").send({
        categoryId: 1,
        roomNumber: "301",
      });

      expect(res.status).toBe(200);
      expect(res.body.room.roomNumber).toBe("301");
    });

    test("rejects duplicate room insert", async () => {
      const res = await api().post("/api/hotel/rooms").send({
        categoryId: 1,
        roomNumber: "101",
      });

      expect(res.status).toBe(500);
    });

    test("updates category price", async () => {
      const res = await api()
        .put("/api/hotel/rooms/category/1/price")
        .send({ defaultPrice: 2600 });

      expect(res.status).toBe(200);
      const rows = await runQuery(
        "SELECT default_price FROM hotel_room_categories WHERE id = 1",
      );
      expect(Number(rows[0].default_price)).toBe(2600);
    });

    test("updates room operational state", async () => {
      const res = await api()
        .put("/api/hotel/rooms/state/101")
        .send({
          guestName: "Ops Guest",
          status: "Occupied",
          checkIn: "2026-03-27",
          checkOut: "2026-03-29",
        });

      expect(res.status).toBe(200);
      const rows = await runQuery(
        "SELECT guest, status FROM hotel_room_inventory WHERE room_number = '101'",
      );
      expect(rows[0].guest).toBe("Ops Guest");
      expect(rows[0].status).toBe("Occupied");
    });
  });

  describe("room block flow", () => {
    test("returns empty room blocks initially", async () => {
      const res = await api().get("/api/hotel/room-blocks");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    test.each([
      [{}, 400],
      [{ room_number: "101" }, 400],
      [{ room_number: "101", blocked_from: "2026-03-29", blocked_until: "2026-03-27" }, 400],
    ])("validates block creation payload %#", async (payload, expectedStatus) => {
      const res = await api().post("/api/hotel/room-block").send(payload);
      expect(res.status).toBe(expectedStatus);
    });

    test("creates room block", async () => {
      const res = await api().post("/api/hotel/room-block").send({
        room_number: "101",
        block_type: "Maintenance",
        reason: "AC service",
        blocked_from: "2026-03-27",
        blocked_until: "2026-03-28",
        blocked_by: "Manager",
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("Active");
    });

    test("marks room as blocked in inventory on create", async () => {
      await api().post("/api/hotel/room-block").send({
        room_number: "101",
        block_type: "Maintenance",
        reason: "AC service",
        blocked_from: "2026-03-27",
        blocked_until: "2026-03-28",
        blocked_by: "Manager",
      });

      const rows = await runQuery(
        "SELECT status FROM hotel_room_inventory WHERE room_number = '101'",
      );
      expect(rows[0].status).toBe("Blocked");
    });

    test("filters blocks by status", async () => {
      await api().post("/api/hotel/room-block").send({
        room_number: "101",
        block_type: "Maintenance",
        blocked_from: "2026-03-27",
        blocked_until: "2026-03-28",
      });

      const res = await api().get("/api/hotel/room-blocks?status=Active");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    test.each([
      [{}, 400],
      [{ status: "Wrong" }, 400],
    ])("validates block status update payload %#", async (payload, expectedStatus) => {
      const res = await api().put("/api/hotel/room-block/1").send(payload);
      expect(res.status).toBe(expectedStatus);
    });

    test("completes block successfully", async () => {
      await api().post("/api/hotel/room-block").send({
        room_number: "101",
        block_type: "Maintenance",
        blocked_from: "2026-03-27",
        blocked_until: "2026-03-28",
      });

      const res = await api().put("/api/hotel/room-block/1").send({
        status: "Completed",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/completed/i);
    });

    test("releases room after completed block", async () => {
      await api().post("/api/hotel/room-block").send({
        room_number: "101",
        block_type: "Maintenance",
        blocked_from: "2026-03-27",
        blocked_until: "2026-03-28",
      });

      await api().put("/api/hotel/room-block/1").send({
        status: "Completed",
      });

      const rows = await runQuery(
        "SELECT status FROM hotel_room_inventory WHERE room_number = '101'",
      );
      expect(rows[0].status).toBe("Available");
    });

    test("cancels block successfully", async () => {
      await api().post("/api/hotel/room-block").send({
        room_number: "102",
        block_type: "Inspection",
        blocked_from: "2026-03-27",
        blocked_until: "2026-03-29",
      });

      const res = await api().put("/api/hotel/room-block/1").send({
        status: "Cancelled",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/cancelled/i);
    });

    test("returns 400 for invalid block id", async () => {
      const res = await api().put("/api/hotel/room-block/abc").send({
        status: "Completed",
      });

      expect(res.status).toBe(400);
    });
  });
});
