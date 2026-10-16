#!/usr/bin/env node
/**
 * Seed script — guarantees every room category has at least 3 rooms.
 *
 * The database shipped with only 2 rooms total (one in "Deluxe", one in
 * "AC ROOM"), leaving 5 of the 7 categories empty. An empty category is a
 * perfectly valid state for the frontend (it renders an empty dropdown), but
 * it means there is nothing to book — so this script fills the inventory.
 *
 * It uses the SAME public API the Add Room UI uses (POST /api/hotel/rooms),
 * so anything it succeeds at is something the UI can also do. It is
 * idempotent: rooms that already exist are reported and skipped.
 *
 * Usage:  node scripts/seed-rooms.js
 */

require("dotenv").config({ quiet: true });

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:5002/api";

// Rooms to guarantee per category, keyed by room_categories.id
const ROOM_PLAN = {
  1: ["101", "102", "103"], // Deluxe (legacy row from the schema seed)
  9003: ["T101", "T102", "T103"], // AC ROOM
  9004: ["N101", "N102", "N103"], // NON-AC ROOM
  9005: ["D201", "D202", "D203"], // DELUXE ROOM
  9006: ["SD301", "SD302", "SD303"], // SUPER DELUXE ROOM
  9007: ["S401", "S402", "S403"], // SUITE ROOM
  9008: ["BD501", "BD502", "BD503"], // DELUXE DORMITORY (per-bed)
};

const call = async (method, path, body) => {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
};

async function main() {
  const setup = await call("GET", "/hotel/rooms/setup");
  if (setup.status !== 200) {
    console.error(`Could not reach the backend at ${API_BASE} (got ${setup.status}).`);
    console.error("Start it first:  npm start");
    process.exit(1);
  }

  const categories = setup.data || [];
  let added = 0;
  let existing = 0;
  let failed = 0;

  for (const [categoryId, roomNumbers] of Object.entries(ROOM_PLAN)) {
    const category = categories.find((c) => String(c.id) === String(categoryId));
    if (!category) {
      console.warn(`! category ${categoryId} not found on the server — skipped`);
      continue;
    }

    for (const roomNumber of roomNumbers) {
      const already = (category.rooms || []).some(
        (r) => String(r).trim().toLowerCase() === roomNumber.toLowerCase(),
      );
      if (already) {
        existing += 1;
        continue;
      }

      const result = await call("POST", "/hotel/rooms", { categoryId, roomNumber });
      if (result.status === 200) {
        added += 1;
        console.log(`  + ${roomNumber.padEnd(7)} -> ${category.name}`);
      } else if (result.data?.message === "Room already exists") {
        existing += 1;
      } else {
        failed += 1;
        console.error(`  ! ${roomNumber} -> ${result.status} ${JSON.stringify(result.data)}`);
      }
    }
  }

  console.log(`\n${added} room(s) added, ${existing} already present, ${failed} failed.`);

  const after = await call("GET", "/hotel/rooms/setup");
  console.log("\nRooms per category:");
  for (const category of after.data || []) {
    const rooms = category.rooms || [];
    const flag = rooms.length >= 3 ? "OK " : rooms.length ? "LOW" : "!!!";
    console.log(`  ${flag} ${category.name.padEnd(20)} ${rooms.length} room(s): ${rooms.join(", ") || "-"}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
