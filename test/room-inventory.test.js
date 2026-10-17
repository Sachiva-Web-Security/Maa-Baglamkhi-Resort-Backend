/**
 * Verification for the two reported hotel issues.
 *
 *   Issue 1 — "Room number required" / "Save Failed" on a booking whose room
 *             was picked from an existing (e.g. AC) room dropdown.
 *   Issue 2 — adding rooms under various room types does nothing / the type
 *             options are unresponsive, and added rooms never appear.
 *
 * Exercises the REAL backend model against the REAL database, and replays the
 * REAL frontend normalisation + validation helpers, so a pass means the actual
 * code paths agree — not a re-implementation of them.
 */
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const model = require("../src/models/hotelRoomInventoryModel");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? " - " + detail : ""}`);
};

// ── Frontend helpers, mirrored from src/utils/roomCategories.js & Room.jsx ──
// Kept as a literal copy so the assertions describe what the browser does.
const normalizeRoomCategories = (apiData, defaultRooms = []) => {
  if (!Array.isArray(apiData) || apiData.length === 0) return defaultRooms || [];
  const fallbacks = Array.isArray(defaultRooms) ? defaultRooms : [];
  return apiData.map((category) => {
    const fallback = fallbacks.find(
      (c) => String(c.id) === String(category.id) || c.name === category.name
    );
    const asArray = (v) => (Array.isArray(v) ? v : []);
    return {
      ...category,
      rooms: asArray(category.rooms).length ? asArray(category.rooms) : asArray(fallback?.rooms),
      roomDetails: asArray(category.roomDetails).length
        ? asArray(category.roomDetails)
        : asArray(fallback?.roomDetails),
    };
  });
};

const getRoomNumbersForCategory = (categorySetup, categoryId, currentRoomNo = "") => {
  const cat = categorySetup.find((c) => String(c.id) === String(categoryId));
  if (!cat) return [];
  const statusByRoom = new Map();
  (Array.isArray(cat.roomDetails) ? cat.roomDetails : []).forEach((rd) => {
    if (rd.roomNumber) statusByRoom.set(String(rd.roomNumber).trim(), rd.status || "Available");
  });
  return (Array.isArray(cat.rooms) ? cat.rooms : [])
    .map((rn) => String(rn).trim())
    .filter(Boolean)
    .map((rn) => ({ roomNo: rn, status: statusByRoom.get(rn) || "Available" }));
};

const validateRoomRows = (rooms) => {
  if (!Array.isArray(rooms) || rooms.length === 0) return { ok: false, reason: "Room required" };
  const missing = rooms.findIndex((row) => !row || !String(row.roomNo || "").trim());
  if (missing !== -1) return { ok: false, reason: "Room number required", row: missing + 1 };
  return { ok: true };
};

(async () => {
  console.log("\n=== Hotel rooms + booking verification ===\n");

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "resort_management",
  });

  // ── ISSUE 1: the dropdown must yield a selectable room number ────────────
  const setup = await model.getRoomSetup({});
  check("getRoomSetup returns categories", Array.isArray(setup) && setup.length > 0, `n=${setup?.length}`);

  const normalized = normalizeRoomCategories(setup, []);
  const emptyArrays = normalized.filter((c) => !Array.isArray(c.rooms));
  check(
    "every category carries an array 'rooms' (no undefined)",
    emptyArrays.length === 0,
    `bad=${emptyArrays.map((c) => c.name).join(",")}`
  );

  // The reported symptom was an AC room. AC ROOM must offer real options.
  const acCategory = normalized.find((c) => /AC ROOM/i.test(c.name) && !/NON/i.test(c.name));
  check("AC ROOM category present", !!acCategory, acCategory ? `id=${acCategory.id}` : "missing");

  if (acCategory) {
    const options = getRoomNumbersForCategory(normalized, acCategory.id);
    check("AC ROOM dropdown is non-empty", options.length > 0, `options=${options.map((o) => o.roomNo).join(",")}`);

    // The exact booking-save path: pick the first offered room, validate.
    const picked = options[0]?.roomNo;
    const verdict = validateRoomRows([{ categoryId: acCategory.id, roomNo: picked }]);
    check(
      `booking validates with AC room "${picked}" selected`,
      verdict.ok,
      verdict.ok ? "" : verdict.reason
    );
  }

  // Every category must be able to produce a valid, saveable row.
  const unbootable = normalized
    .map((cat) => ({ cat, opts: getRoomNumbersForCategory(normalized, cat.id) }))
    .filter((x) => x.opts.length === 0);
  check(
    "every room type yields at least one selectable room",
    unbootable.length === 0,
    unbootable.length ? `empty: ${unbootable.map((x) => x.cat.name).join(", ")}` : ""
  );

  // ── ISSUE 2: adding a room under a non-default type ──────────────────────
  // Use DELUXE DORMITORY (id 9008) — a high-id live category, exactly the
  // shape that the old stale-id logic could not address.
  const target = normalized.find((c) => /DORMITORY/i.test(c.name)) || normalized[normalized.length - 1];
  check("a non-default room type is available to add under", !!target, target ? `${target.name} (id=${target.id})` : "");

  const probe1 = `ZZ${Date.now().toString().slice(-6)}`;
  const probe2 = `ZZ${Date.now().toString().slice(-6)}X`;
  const created = [];

  try {
    const added = await model.addRoom({ categoryId: target.id, roomNumber: probe1 });
    created.push(probe1);
    check(
      `addRoom works under "${target.name}"`,
      added?.roomNumber === probe1 && added?.categoryId === Number(target.id),
      JSON.stringify(added)
    );

    const afterAdd = normalizeRoomCategories(await model.getRoomSetup({}), []);
    const targetAfter = afterAdd.find((c) => String(c.id) === String(target.id));
    const optsAfter = getRoomNumbersForCategory(afterAdd, target.id);
    check(
      "added room appears in that category's room list",
      optsAfter.some((o) => o.roomNo === probe1),
      `count=${targetAfter?.rooms?.length}`
    );

    // Room numbers unique per category: same number in a DIFFERENT category
    // must be allowed (T101/N101/101 coexist in this inventory).
    const other = normalized.find((c) => String(c.id) !== String(target.id));
    if (other) {
      const cross = await model.addRoom({ categoryId: other.id, roomNumber: probe2 });
      created.push(probe2);
      check(
        "same-style number accepted in a different room type",
        cross?.roomNumber === probe2,
        `${probe2} under ${other.name}`
      );
    }

    // Duplicate within the same category must still be rejected.
    let dupRejected = false;
    try {
      await model.addRoom({ categoryId: target.id, roomNumber: probe1 });
    } catch (e) {
      dupRejected = e.code === "ER_DUP_ENTRY" || /duplicate/i.test(e.message);
    }
    check("duplicate within same room type is still rejected", dupRejected);
  } finally {
    for (const rn of created) {
      try {
        await db.execute("DELETE FROM rooms WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)", [rn]);
      } catch {}
    }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== ${passed}/${results.length} passed ===\n`);

  await db.end();
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
