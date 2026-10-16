import { jest } from "@jest/globals";
import {
  normalizeRoomCategories,
  normalizeRoomTypeName,
} from "../src/utils/roomCategories.js";

// Mirror of DEFAULT_ROOMS in src/components/Hotel/Room.jsx — the hard-coded
// fallback list BookingFlow merges the live payload with.
const DEFAULT_ROOMS = [
  { id: 2, name: "NON-AC ROOM", defaultPrice: 1500, unitLabel: "PER NIGHT" },
  { id: 3, name: "SUPER DELUXE ROOM", defaultPrice: 3000, unitLabel: "PER NIGHT" },
  { id: 4, name: "EXECUTIVE ROOM ", defaultPrice: 4000, unitLabel: "PER NIGHT" },
  { id: 5, name: "SUPER EXECUTIVE ROOM", defaultPrice: 5000, unitLabel: "PER NIGHT" },
  { id: 6, name: "SUITE ROOM", defaultPrice: 800, unitLabel: "PER BED" },
];

// The live payload shape produced by GET /api/hotel/rooms/setup. Note the
// categories that legitimately have no rooms yet arrive with `rooms: []` and
// `roomDetails: []`, and categories absent from DEFAULT_ROOMS have no fallback
// entry at all.
const LIVE_SETUP = [
  {
    id: 1,
    name: "Deluxe",
    defaultPrice: "0.00",
    unitLabel: "Room",
    rooms: ["101"],
    roomDetails: [{ roomNumber: "101", status: "cleaning" }],
  },
  {
    id: 9003,
    name: "AC ROOM",
    defaultPrice: "2000.00",
    unitLabel: "PER NIGHT",
    rooms: ["T101"],
    roomDetails: [{ roomNumber: "T101", status: "available" }],
  },
  {
    id: 9004,
    name: "NON-AC ROOM",
    defaultPrice: "1500.00",
    unitLabel: "PER NIGHT",
    rooms: [],
    roomDetails: [],
  },
  {
    id: 9005,
    name: "DELUXE ROOM",
    defaultPrice: "3000.00",
    unitLabel: "PER NIGHT",
    rooms: [],
    roomDetails: [],
  },
  {
    id: 9006,
    name: "SUPER DELUXE ROOM",
    defaultPrice: "4000.00",
    unitLabel: "PER NIGHT",
    rooms: [],
    roomDetails: [],
  },
  {
    id: 9007,
    name: "SUITE ROOM",
    defaultPrice: "5000.00",
    unitLabel: "PER NIGHT",
    rooms: [],
    roomDetails: [],
  },
  {
    id: 9008,
    name: "DELUXE DORMITORY",
    defaultPrice: "800.00",
    unitLabel: "PER BED",
    rooms: [],
    roomDetails: [],
  },
];

// The lookup BookingFlow's getRoomNumbersForCategory() performs on every render
// of the room-number dropdown.
const roomOptionsFor = (categories, categoryId) => {
  const category = categories.find((c) => String(c.id) === String(categoryId));
  if (!category) return [];
  return (Array.isArray(category.rooms) ? category.rooms : []).map((rn) =>
    String(rn).trim(),
  );
};

describe("normalizeRoomTypeName", () => {
  test("upper-cases and collapses separators so room type names compare equal", () => {
    expect(normalizeRoomTypeName(" super-deluxe_room ")).toBe("SUPER DELUXE ROOM");
    expect(normalizeRoomTypeName("Suite Room")).toBe(normalizeRoomTypeName("SUITE   ROOM"));
    expect(normalizeRoomTypeName(null)).toBe("");
  });
});

describe("normalizeRoomCategories", () => {
  test("every category keeps an array for rooms and roomDetails", () => {
    const result = normalizeRoomCategories(LIVE_SETUP, DEFAULT_ROOMS);

    result.forEach((category) => {
      expect(Array.isArray(category.rooms)).toBe(true);
      expect(Array.isArray(category.roomDetails)).toBe(true);
    });
  });

  test("live rooms win over the fallback when present", () => {
    const result = normalizeRoomCategories(LIVE_SETUP, DEFAULT_ROOMS);

    const acRoom = result.find((c) => c.id === 9003);
    expect(acRoom.rooms).toEqual(["T101"]);
    expect(acRoom.roomDetails).toHaveLength(1);

    const deluxe = result.find((c) => c.id === 1);
    expect(deluxe.rooms).toEqual(["101"]);
  });

  // Regression guard for issue 2: a category with no rooms must stay an empty
  // array, never `undefined`. The old merge collapsed `[]` to
  // `fallback.rooms`, which is undefined for DELUXE ROOM / SUPER DELUXE ROOM /
  // DELUXE DORMITORY, leaving those room types with an empty, unselectable
  // dropdown.
  test("empty categories stay empty arrays instead of becoming undefined", () => {
    const result = normalizeRoomCategories(LIVE_SETUP, DEFAULT_ROOMS);

    const deluxeRoom = result.find((c) => c.name === "DELUXE ROOM");
    expect(deluxeRoom.rooms).toEqual([]);
    expect(deluxeRoom.roomDetails).toEqual([]);

    const superDeluxe = result.find((c) => c.name === "SUPER DELUXE ROOM");
    expect(superDeluxe.rooms).toEqual([]);

    const dormitory = result.find((c) => c.name === "DELUXE DORMITORY");
    expect(dormitory.rooms).toEqual([]);
  });

  test("room type dropdowns resolve for every category, including empty ones", () => {
    const result = normalizeRoomCategories(LIVE_SETUP, DEFAULT_ROOMS);

    result.forEach((category) => {
      const options = roomOptionsFor(result, category.id);
      expect(options).toEqual(Array.isArray(category.rooms) ? category.rooms : []);
    });
  });

  test("a room added to a previously empty category becomes selectable", () => {
    const withNewRoom = LIVE_SETUP.map((c) =>
      c.id === 9005 ? { ...c, rooms: ["201"], roomDetails: [{ roomNumber: "201", status: "available" }] } : c,
    );

    const result = normalizeRoomCategories(withNewRoom, DEFAULT_ROOMS);
    expect(roomOptionsFor(result, 9005)).toEqual(["201"]);
  });

  test("a category the backend left blank resolves to an empty array, not undefined", () => {
    // DEFAULT_ROOMS carries only defaultPrice/unitLabel — it has no `rooms`
    // array of its own — so a category with no live rooms must still come out
    // as `[]` rather than the `undefined` the old merge produced.
    const sparse = [{ id: 2, name: "NON-AC ROOM", defaultPrice: 1500 }];
    const result = normalizeRoomCategories(sparse, DEFAULT_ROOMS);

    expect(result[0].rooms).toEqual([]);
    expect(result[0].roomDetails).toEqual([]);
    // Price still falls back from DEFAULT_ROOMS.
    expect(result[0].unitLabel).toBe("PER NIGHT");
  });

  test("prices and unit labels survive the merge, with fallbacks applied", () => {
    const result = normalizeRoomCategories(LIVE_SETUP, DEFAULT_ROOMS);

    expect(result.find((c) => c.id === 9003).defaultPrice).toBe("2000.00");
    expect(result.find((c) => c.id === 9003).unitLabel).toBe("PER NIGHT");
    // "Deluxe" has no fallback entry, so the merge must not invent one.
    expect(result.find((c) => c.id === 1).defaultPrice).toBe("0.00");
  });

  test("an empty or missing payload falls back to the default list", () => {
    expect(normalizeRoomCategories([], DEFAULT_ROOMS)).toEqual(DEFAULT_ROOMS);
    expect(normalizeRoomCategories(null, DEFAULT_ROOMS)).toEqual(DEFAULT_ROOMS);
    expect(normalizeRoomCategories(undefined, DEFAULT_ROOMS)).toEqual(DEFAULT_ROOMS);
  });

  test("a malformed payload never throws and never yields undefined rooms", () => {
    const malformed = [
      { id: 9003, name: "AC ROOM", rooms: null, roomDetails: null },
      { id: 9005, name: "DELUXE ROOM", rooms: "T101", roomDetails: {} },
      { id: 9007, name: "SUITE ROOM" },
    ];

    const result = normalizeRoomCategories(malformed, DEFAULT_ROOMS);
    result.forEach((category) => {
      expect(Array.isArray(category.rooms)).toBe(true);
      expect(Array.isArray(category.roomDetails)).toBe(true);
    });
  });
});
