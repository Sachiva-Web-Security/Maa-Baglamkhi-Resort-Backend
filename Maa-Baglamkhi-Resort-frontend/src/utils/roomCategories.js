// src/utils/roomCategories.js
//
// Normalisation for the payload returned by GET /api/hotel/rooms/setup.
//
// ROOT CAUSE (issue 2 — "Add Hotel Rooms: options unresponsive / rooms not added"):
// The old inline merge in BookingFlow.jsx was
//
//     rooms: Array.isArray(cat.rooms) && cat.rooms.length ? cat.rooms : fallback.rooms
//
// `cat.rooms` arrives from the backend as a real array — `[]` for a room type
// that simply has no rooms yet. The `&& cat.rooms.length` clause threw that
// valid empty array away and returned `fallback.rooms` instead, which is
// `undefined` for every category missing from DEFAULT_ROOMS (DELUXE ROOM,
// SUPER DELUXE ROOM, DELUXE DORMITORY, and the live "Deluxe" row created by
// ensureSchema). Downstream, getRoomNumbersForCategory() reads
//
//     Array.isArray(cat.rooms) ? cat.rooms : []     ->   []
//
// so those room types rendered a dropdown with zero options, permanently
// disabled behind `disabled={!row.categoryId}` plus an option list that never
// filled. Picking the category looked fine, but the room select could never
// produce a value, so validateForm() reported "Room number required" and the
// booking refused to save.
//
// normalizeRoomCategories() guarantees every category leaves here with real
// arrays for both `rooms` and `roomDetails`, so the dropdown always renders
// and newly added rooms always appear.

export const normalizeRoomTypeName = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

const asArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Merge the live /hotel/rooms/setup payload with the hard-coded DEFAULT_ROOMS
 * fallback list, guaranteeing array-typed `rooms` / `roomDetails` on every row.
 *
 * Live data always wins when it is non-empty; the fallback only fills gaps for
 * a category the backend could not describe. An empty category is a valid
 * state (no rooms added yet) and is preserved as `[]` rather than `undefined`.
 */
export const normalizeRoomCategories = (apiData, defaultRooms = []) => {
  if (!Array.isArray(apiData) || apiData.length === 0) {
    return Array.isArray(defaultRooms) ? defaultRooms : [];
  }

  const fallbacks = Array.isArray(defaultRooms) ? defaultRooms : [];

  return apiData.map((category) => {
    const fallback = fallbacks.find(
      (candidate) =>
        String(candidate.id) === String(category.id) ||
        normalizeRoomTypeName(candidate.name) ===
          normalizeRoomTypeName(category.name),
    );

    const liveRooms = asArray(category.rooms);
    const liveDetails = asArray(category.roomDetails);
    const fallbackRooms = asArray(fallback?.rooms);
    const fallbackDetails = asArray(fallback?.roomDetails);

    return {
      ...category,
      rooms: liveRooms.length ? liveRooms : fallbackRooms,
      roomDetails: liveDetails.length ? liveDetails : fallbackDetails,
      defaultPrice: category.defaultPrice || fallback?.defaultPrice || 0,
      unitLabel: category.unitLabel || fallback?.unitLabel || "PER NIGHT",
    };
  });
};
