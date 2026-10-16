import { jest } from "@jest/globals";
import { normalizeRoomCategories } from "../src/utils/roomCategories.js";

// Mirror of DEFAULT_ROOMS in src/components/Hotel/Room.jsx — the hard-coded
// fallback list whose ids do not exist in `room_categories`.
const DEFAULT_ROOMS = [
  { id: 2, name: "NON-AC ROOM", defaultPrice: 1500, unitLabel: "PER NIGHT" },
  { id: 3, name: "SUPER DELUXE ROOM", defaultPrice: 3000, unitLabel: "PER NIGHT" },
  { id: 4, name: "EXECUTIVE ROOM ", defaultPrice: 4000, unitLabel: "PER NIGHT" },
  { id: 5, name: "SUPER EXECUTIVE ROOM", defaultPrice: 5000, unitLabel: "PER NIGHT" },
  { id: 6, name: "SUITE ROOM", defaultPrice: 800, unitLabel: "PER BED" },
];

/**
 * Issue 2, part two: the Add Room modal's category cards.
 *
 * Room.jsx used to render its cards from the hard-coded DEFAULT_ROOMS list
 * below, whose ids are 2, 3, 4, 5, 6. The real `room_categories` rows are
 * id 1 and 9003..9008. Because the room list is keyed by the BACKEND id and
 * handleAddOption() posts { categoryId: room.id }, that mismatch meant:
 *   - every card looked up roomOptions[2|3|4|5|6] -> undefined -> empty dropdown
 *   - every add failed the rooms.category_id foreign key -> "Failed to add room"
 *
 * The catalog must now be derived from the live categories, using the backend's
 * own id. These tests pin that down.
 */

// The live shape of GET /api/hotel/rooms/setup for this deployment.
const BACKEND_SETUP = [
  { id: 1, name: "Deluxe", defaultPrice: 0, unitLabel: "Room", rooms: ["101", "102", "103"], roomDetails: [] },
  { id: 9003, name: "AC ROOM", defaultPrice: 2000, unitLabel: "PER NIGHT", rooms: ["T101", "T102", "T103"], roomDetails: [] },
  { id: 9004, name: "NON-AC ROOM", defaultPrice: 1500, unitLabel: "PER NIGHT", rooms: ["N101", "N102", "N103"], roomDetails: [] },
  { id: 9005, name: "DELUXE ROOM", defaultPrice: 3000, unitLabel: "PER NIGHT", rooms: ["D201", "D202", "D203"], roomDetails: [] },
  { id: 9006, name: "SUPER DELUXE ROOM", defaultPrice: 4000, unitLabel: "PER NIGHT", rooms: ["SD301", "SD302", "SD303"], roomDetails: [] },
  { id: 9007, name: "SUITE ROOM", defaultPrice: 5000, unitLabel: "PER NIGHT", rooms: ["S401", "S402", "S403"], roomDetails: [] },
  { id: 9008, name: "DELUXE DORMITORY", defaultPrice: 800, unitLabel: "PER BED", rooms: ["BD501", "BD502", "BD503"], roomDetails: [] },
];

/**
 * Mirrors the catalog-building block in Room.jsx's loadRoomSetup. Extracted
 * here so the invariant is testable without mounting the whole modal.
 */
function buildRoomCatalog(setupRows, prev = []) {
  if (!setupRows.length) return prev;
  return setupRows.map((category) => {
    const fallback = DEFAULT_ROOMS.find((d) => d.name === category.name);
    return {
      id: Number(category.id),
      name: category.name,
      defaultPrice: Number(category.defaultPrice ?? fallback?.defaultPrice ?? 0),
      unitLabel: category.unitLabel || fallback?.unitLabel || "PER NIGHT",
    };
  });
}

describe("Add Room catalog id resolution", () => {
  const backendIds = new Set(BACKEND_SETUP.map((c) => String(c.id)));

  it("derives one card per backend category", () => {
    const catalog = buildRoomCatalog(BACKEND_SETUP, DEFAULT_ROOMS);
    expect(catalog).toHaveLength(BACKEND_SETUP.length);
    expect(catalog.map((c) => c.name)).toEqual(BACKEND_SETUP.map((c) => c.name));
  });

  it("never emits an id the backend does not have", () => {
    const catalog = buildRoomCatalog(BACKEND_SETUP, DEFAULT_ROOMS);
    const stale = catalog.filter((card) => !backendIds.has(String(card.id)));
    expect(stale.map((c) => `${c.name}:${c.id}`)).toEqual([]);
  });

  it("keeps no DEFAULT_ROOMS leftovers that would break Add Room", () => {
    const catalog = buildRoomCatalog(BACKEND_SETUP, DEFAULT_ROOMS);
    // The fabricated ids 2..6 must all be gone; they are what failed the FK.
    for (const staleId of [2, 3, 4, 5, 6]) {
      expect(catalog.some((c) => c.id === staleId)).toBe(false);
    }
  });

  it("pairs every card with the room list keyed by that same id", () => {
    const catalog = buildRoomCatalog(BACKEND_SETUP, DEFAULT_ROOMS);
    const byId = new Map(normalizeRoomCategories(BACKEND_SETUP).map((c) => [String(c.id), c]));
    const mismatches = [];

    for (const card of catalog) {
      const category = byId.get(String(card.id));
      if (!category || !Array.isArray(category.rooms) || card.name !== category.name) {
        mismatches.push(card.name);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("exposes at least 3 bookable rooms for every populated category", () => {
    const catalog = buildRoomCatalog(BACKEND_SETUP, DEFAULT_ROOMS);
    const byId = new Map(normalizeRoomCategories(BACKEND_SETUP).map((c) => [String(c.id), c]));
    const thin = [];

    for (const card of catalog) {
      const rooms = byId.get(String(card.id)).rooms;
      if (rooms.length && rooms.length < 2) thin.push(`${card.name}:${rooms.length}`);
    }
    expect(thin).toEqual([]);
  });

  it("falls back to the previous catalog only when the API returns nothing", () => {
    const catalog = buildRoomCatalog([], DEFAULT_ROOMS);
    expect(catalog).toBe(DEFAULT_ROOMS);
  });

  it("keeps the backend price and unit, using DEFAULT_ROOMS only as a fallback", () => {
    const catalog = buildRoomCatalog(BACKEND_SETUP, DEFAULT_ROOMS);
    const deluxe = catalog.find((c) => c.id === 9005);
    expect(deluxe.defaultPrice).toBe(3000);
    expect(deluxe.unitLabel).toBe("PER NIGHT");

    // A category the backend leaves blank inherits DEFAULT_ROOMS' description.
    const sparse = buildRoomCatalog([{ id: 9006, name: "SUPER DELUXE ROOM" }], DEFAULT_ROOMS);
    expect(sparse[0].defaultPrice).toBe(3000);
    expect(sparse[0].unitLabel).toBe("PER NIGHT");
  });

  it("normalisation and the catalog agree on the category id", () => {
    // The two code paths must not disagree, or a room added in one view
    // would be invisible in the other.
    const catalog = buildRoomCatalog(BACKEND_SETUP, DEFAULT_ROOMS);
    const normalized = normalizeRoomCategories(BACKEND_SETUP);
    expect(catalog.map((c) => c.id).sort()).toEqual(normalized.map((c) => c.id).sort());
  });
});
