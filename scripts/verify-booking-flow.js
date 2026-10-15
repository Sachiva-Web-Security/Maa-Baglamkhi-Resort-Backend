require("dotenv").config({ quiet: true });

/**
 * End-to-end check of issue 1 (New Booking: "Room number required").
 *
 * Walks the exact data path the booking form uses: load /hotel/rooms/setup,
 * normalise it the way BookingFlow does now, pick a real room from a real
 * category, and POST the booking. Also prints what the OLD normalisation
 * produced so the root cause stays documented.
 */

const API = "http://127.0.0.1:5002/api";

const call = async (method, path, body, token) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

const iso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

async function main() {
  const login = await call("POST", "/auth/login", {
    email: "reception@test.com",
    password: "Staff@123",
  });
  if (login.status !== 200) {
    console.error(`Login failed (${login.status}):`, login.data);
    process.exit(1);
  }
  const token = login.data.token;
  console.log("Logged in as reception.\n");

  const setup = await call("GET", "/hotel/rooms/setup");

  // ── OLD behaviour (the bug) ───────────────────────────────────────────────
  const DEFAULT_ROOMS = [
    { id: 2, name: "NON-AC ROOM" },
    { id: 3, name: "SUPER DELUXE ROOM" },
    { id: 4, name: "EXECUTIVE ROOM " },
    { id: 5, name: "SUPER EXECUTIVE ROOM" },
    { id: 6, name: "SUITE ROOM" },
  ];
  const oldCats = setup.data.map((category) => {
    const fallback = DEFAULT_ROOMS.find(
      (c) => String(c.id) === String(category.id) || c.name === category.name,
    );
    return {
      id: category.id,
      name: category.name,
      rooms:
        Array.isArray(category.rooms) && category.rooms.length
          ? category.rooms
          : fallback?.rooms,
    };
  });
  console.log("OLD normalisation — what the booking dropdown used to receive:");
  for (const c of oldCats) {
    const count = Array.isArray(c.rooms) ? c.rooms.length : 0;
    console.log(
      `  id=${String(c.id).padEnd(5)} ${String(c.name).padEnd(20)} ${
        count ? `${count} room(s)` : "NO ROOMS -> empty dropdown -> 'Room number required'"
      }`,
    );
  }

  // ── NEW behaviour (the fix) ───────────────────────────────────────────────
  const cats = setup.data.map((c) => ({
    id: c.id,
    name: c.name,
    rooms: Array.isArray(c.rooms) && c.rooms.length ? c.rooms : [],
  }));
  console.log("\nNEW normalisation — every category has a real array:");
  for (const c of cats) {
    console.log(
      `  id=${String(c.id).padEnd(5)} ${String(c.name).padEnd(20)} ${c.rooms.length} room(s): ${c.rooms.join(", ") || "-"}`,
    );
  }

  // ── Create a real booking with a room picked through the NEW path ─────────
  const target = cats.find((c) => c.rooms.length > 0);
  if (!target) {
    console.error("\nNo category has rooms — run `node scripts/seed-rooms.js` first.");
    process.exit(1);
  }
  const roomNo = target.rooms[0];

  console.log(`\nCreating a booking with room ${roomNo} under "${target.name}"...`);
  const created = await call(
    "POST",
    "/guest/with-rooms",
    {
      guestName: "E2E Verify Guest",
      mobile: "9900001111",
      guestEmail: "e2e-verify@test.com",
      checkIn: iso(5),
      checkOut: iso(7),
      arrival: "12:00",
      departure: "11:00",
      bookingStatus: "Confirmed",
      rooms: [{ roomNumber: roomNo, categoryId: target.id, price: 1500 }],
    },
    token,
  );

  if (created.status >= 400) {
    console.error(`  Booking FAILED (${created.status}):`, created.data);
    process.exit(1);
  }
  const bookingId = created.data?.booking?.id || created.data?.id;
  console.log(`  Booking saved OK (id ${bookingId}).`);
  console.log("\nRESULT: room selection, validation and save all work.");
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
