require("dotenv").config({ quiet: true });

/**
 * End-to-end check of issue 1 (New Booking: "Room number required").
 *
 * Walks the exact data path the booking form uses: load /hotel/rooms/setup,
 * normalise it the way BookingFlow does now, pick a real room from a real
 * category, and POST the booking. Also prints what the OLD normalisation
 * produced so the root cause stays documented.
 */

const ROOT = "http://127.0.0.1:5002/api";
// bookingRoutes is mounted twice: /api/hotel and /api/booking.
const API = `${ROOT}/hotel`;

const call = async (method, path, body, token) => {
  const res = await fetch(path.startsWith("http") ? path : API + path, {
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
  const email = "verify.reception@test.com";
  const password = "Verify@123";

  // The admin seeded by seed-db.js has a plaintext hash the auth layer rejects,
  // so register a reception user through the API (idempotent: ignore "already
  // registered" and fall through to the login below).
  await call("POST", `${ROOT}/auth/register`, {
    name: "Verify Reception",
    email,
    password,
    role: "reception",
  });

  const login = await call("POST", `${ROOT}/auth/login`, { email, password });
  if (login.status !== 200) {
    console.error(`Login failed (${login.status}):`, login.data);
    process.exit(1);
  }
  const token = login.data.token;
  console.log("Logged in as reception.\n");

  const setup = await call("GET", "/rooms/setup", null, token);
  const setupRows = Array.isArray(setup.data) ? setup.data : [];

  if (!setupRows.length) {
    console.error(`/hotel/rooms/setup returned no rows (${setup.status}).`);
    process.exit(1);
  }

  // ── OLD behaviour (the bug) ───────────────────────────────────────────────
  const DEFAULT_ROOMS = [
    { id: 2, name: "NON-AC ROOM" },
    { id: 3, name: "SUPER DELUXE ROOM" },
    { id: 4, name: "EXECUTIVE ROOM " },
    { id: 5, name: "SUPER EXECUTIVE ROOM" },
    { id: 6, name: "SUITE ROOM" },
  ];
  const oldCats = setupRows.map((category) => {
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
  const cats = setupRows.map((c) => ({
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
  if (!cats.some((c) => c.rooms.length > 0)) {
    console.error("\nNo category has rooms — run `node scripts/seed-rooms.js` first.");
    process.exit(1);
  }

  // Pick a room that isn't already booked for our dates, so the run is
  // repeatable. updateFullBooking enforces a real overlap check, so a room
  // that's taken would correctly 409 — that's the server working, not a bug.
  // A window far enough out that no existing booking can touch it, so the run
  // is repeatable regardless of what the overlap endpoints decide about the
  // checkout-day boundary (they currently disagree on that edge).
  const checkIn = iso(60);
  const checkOut = iso(62);
  // Ask per-room (validate-availability takes a single room and answers with
  // { available, conflicts }). updateFullBooking enforces a real overlap check,
  // so a taken room would correctly 409 — that's the server working, not a bug.
  const free = new Set();
  for (const c of cats) {
    for (const rn of c.rooms) {
      const probe = await call(
        "POST",
        "/rooms/validate-availability",
        { rooms: [{ roomNumber: rn }], checkIn, checkOut },
        token,
      );
      if (probe.status === 200 && probe.data?.available) free.add(String(rn).trim());
    }
  }
  const candidate = cats.find((c) => c.rooms.some((rn) => free.has(String(rn).trim())));
  if (!candidate) {
    console.error("No free room in the tested date range; adjust iso() offsets.");
    process.exit(1);
  }
  const roomNo = candidate.rooms.find((rn) => free.has(String(rn).trim()));

  console.log(`\nCreating a booking with room ${roomNo} under "${candidate.name}"...`);
  const created = await call(
    "POST",
    "/guest",
    {
      guestName: "E2E Verify Guest",
      mobile: "9900001111",
      guestEmail: "e2e-verify@test.com",
      checkIn,
      checkOut,
      arrival: "12:00",
      departure: "11:00",
      bookingStatus: "Confirmed",
      adults: 2,
    },
    token,
  );

  if (created.status >= 400) {
    console.error(`  Booking FAILED (${created.status}):`, created.data);
    process.exit(1);
  }
  const bookingId = created.data?.insertId || created.data?.bookingId;
  console.log(`  Booking created (id ${bookingId}).`);

  // Attach the room — this is the shape updateFullBooking validates, including
  // its overlap check.
  const attached = await call(
    "PUT",
    `/full-booking/${bookingId}`,
    {
      guestName: "E2E Verify Guest",
      mobile: "9900001111",
      checkIn,
      checkOut,
      rooms: [{ room_number: roomNo, roomNumber: roomNo, categoryId: candidate.id }],
    },
    token,
  );

  if (attached.status >= 400) {
    console.error(`  Room attach FAILED (${attached.status}):`, attached.data);
    process.exit(1);
  }
  console.log(`  Room ${roomNo} attached OK (id ${bookingId}).`);
  console.log("\nRESULT: room selection, validation and save all work.");
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
