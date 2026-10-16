import { jest } from "@jest/globals";
import { withAudit } from "../src/utils/auditAction.js";
import { getRoleHome, getRoleLabel, normalizeRole } from "../src/utils/roleHome.js";
import {
  clearDashboardNotifications,
  getDashboardNotifications,
  pushDashboardNotification,
  upsertDashboardNotification,
} from "../src/components/Dashboard/dashboardNotifications.js";
import {
  addCompletedCleaningLog,
  clearBookingSession,
  getBookingDraft,
  getCleaningTasks,
  getCompletedCleaningLogs,
  getStoredBookingCode,
  getStoredBookingId,
  removeCleaningTask,
  setBookingDraft,
  setCleaningTasks,
  setStoredBookingCode,
  setStoredBookingId,
  upsertCleaningTask,
} from "../src/components/Hotel/bookingSession.js";
import { frontendSeed } from "./fixtures/frontendSeed.js";

describe("frontend utility coverage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("roleHome utilities normalize roles and resolve labels/home routes", () => {
    expect(normalizeRole("  MANAGER ")).toBe("manager");
    expect(getRoleHome("receptionist")).toBe("/reception-dashboard");
    expect(getRoleHome("unknown-role")).toBe("/login");
    expect(getRoleLabel("accountant")).toBe("Accountant");
    expect(getRoleLabel("mystery")).toBe("User");
  });

  test("withAudit decorates config with audit action", () => {
    expect(withAudit("update", { headers: { foo: "bar" } })).toEqual({
      headers: { foo: "bar" },
      auditAction: "update",
    });
  });

  test("dashboard notifications push and clear records from storage", () => {
    jest.spyOn(Date, "now").mockReturnValue(1710000000000);
    jest.spyOn(Math, "random").mockReturnValue(0.123456);

    const created = pushDashboardNotification({
      title: "Room dirty",
      message: "Room 201 marked dirty",
      type: "warning",
      route: "/housekeeping",
      meta: { source: "housekeeping", roomNo: "201" },
    });

    const stored = getDashboardNotifications();

    expect(created.id).toContain("1710000000000");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      title: "Room dirty",
      route: "/housekeeping",
      meta: { source: "housekeeping", roomNo: "201" },
    });
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);

    clearDashboardNotifications();
    expect(getDashboardNotifications()).toEqual([]);
  });

  test("dashboard notifications upsert removes matching duplicate records", () => {
    pushDashboardNotification({
      title: "Checkout pending",
      message: "Room 101 checkout pending",
      route: "/hotel",
      meta: { source: "frontdesk", roomNo: "101" },
    });

    upsertDashboardNotification(
      {
        title: "Checkout pending",
        message: "Room 101 checkout pending",
        route: "/hotel",
        meta: { source: "frontdesk", roomNo: "101" },
      },
      ["title", "message", "route", "meta.source", "meta.roomNo"],
    );

    expect(getDashboardNotifications()).toHaveLength(1);
  });

  test("booking session stores ids, draft, and clears active session keys", () => {
    setStoredBookingId(frontendSeed.hotel.bookingId);
    setStoredBookingCode(frontendSeed.hotel.bookingCode);
    setBookingDraft("guest", frontendSeed.hotel.bookingDraft.guest);
    setBookingDraft("stay", frontendSeed.hotel.bookingDraft.stay);

    expect(getStoredBookingId()).toBe(String(frontendSeed.hotel.bookingId));
    expect(getStoredBookingCode()).toBe(frontendSeed.hotel.bookingCode);
    expect(getBookingDraft("guest")).toEqual(frontendSeed.hotel.bookingDraft.guest);
    expect(getBookingDraft()).toEqual(frontendSeed.hotel.bookingDraft);

    clearBookingSession();

    expect(getStoredBookingId()).toBe("");
    expect(getStoredBookingCode()).toBe("");
    expect(getBookingDraft()).toEqual({});
  });

  test("cleaning task storage upserts and removes task entries", () => {
    setCleaningTasks({ 101: { status: "dirty" } });
    upsertCleaningTask("201", frontendSeed.housekeeping.room);

    expect(getCleaningTasks()).toEqual({
      101: { status: "dirty" },
      201: frontendSeed.housekeeping.room,
    });

    removeCleaningTask("101");
    expect(getCleaningTasks()).toEqual({
      201: frontendSeed.housekeeping.room,
    });
  });

  test("completed cleaning log list prepends new entries and keeps timestamps", () => {
    addCompletedCleaningLog({
      roomNo: "201",
      assignee: "Neha",
      notes: "Completed deep clean",
    });

    const [latest] = getCompletedCleaningLogs();
    expect(latest).toMatchObject({
      roomNo: "201",
      assignee: "Neha",
      notes: "Completed deep clean",
    });
    expect(latest.completedAt).toBeTruthy();
  });
});
