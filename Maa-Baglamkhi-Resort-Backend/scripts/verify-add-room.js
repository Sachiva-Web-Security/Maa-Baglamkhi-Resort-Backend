require("dotenv").config({ quiet: true });

/**
 * End-to-end check of issue 2 (Add Hotel Rooms).
 *
 * Room.jsx used to drive its cards from DEFAULT_ROOMS ids (2,3,4,5,6), which
 * don't exist in room_categories. Adding a room posted { categoryId: 2 }, which
 * fails on the rooms.category_id foreign key. This walks the fixed path: for
 * every category, add a room, confirm it comes back in /rooms/setup, then
 * delete it again so the run leaves the inventory as it found it.
 */

const ROOT = "http://127.0.0.1:5002/api";
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

async function main() {
  const email = "verify.reception@test.com";
  const password = "Verify@123";

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

  // ── OLD behaviour: the ids the cards used to send ─────────────────────────
  const DEFAULT_ROOMS = [
    { id: 2, name: "NON-AC ROOM" },
    { id: 3, name: "SUPER DELUXE ROOM" },
    { id: 4, name: "EXECUTIVE ROOM " },
    { id: 5, name: "SUPER EXECUTIVE ROOM" },
    { id: 6, name: "SUITE ROOM" },
  ];
  console.log("OLD card ids (from DEFAULT_ROOMS) vs real room_categories ids:");
  const setup = await call("GET", "/rooms/setup", null, token);
  const realIds = new Set(setup.data.map((c) => Number(c.id)));
  for (const d of DEFAULT_ROOMS) {
    console.log(
      `  id=${String(d.id).padEnd(5)} ${d.name.padEnd(24)} ${
        realIds.has(Number(d.id)) ? "exists" : "DOES NOT EXIST -> foreign key error on add"
      }`,
    );
  }

  // ── NEW behaviour: add + verify + delete for every real category ──────────
  console.log("\nAdding one room under every real category:");
  let failures = 0;
  const added = [];

  for (const cat of setup.data) {
    const roomNo = `ZZ-${cat.id}-${Date.now() % 100000}`;

    const create = await call(
      "POST",
      "/rooms",
      { categoryId: cat.id, roomNumber: roomNo },
      token,
    );

    if (create.status >= 400) {
      console.log(`  FAIL ${cat.name.padEnd(20)} add -> ${create.status} ${JSON.stringify(create.data)}`);
      failures += 1;
      continue;
    }

    // Confirm it now shows up in the setup the UI renders from.
    const after = await call("GET", "/rooms/setup", null, token);
    const refreshed = after.data.find((c) => Number(c.id) === Number(cat.id));
    const visible = (refreshed?.rooms || []).map(String).includes(roomNo);

    if (!visible) {
      console.log(`  FAIL ${cat.name.padEnd(20)} added but NOT listed back`);
      failures += 1;
      continue;
    }

    added.push({ id: cat.id, name: cat.name, roomNo });
    console.log(`  OK   ${cat.name.padEnd(20)} ${roomNo} added and listed`);
  }

  // ── Clean up so the inventory is left as we found it ─────────────────────
  if (added.length) {
    console.log("\nRemoving the rooms this run created:");
    for (const a of added) {
      const del = await call(
        "DELETE",
        `/rooms/${encodeURIComponent(a.roomNo)}`,
        null,
        token,
      );
      console.log(
        `  ${del.status < 400 ? "OK  " : "WARN"} ${a.name.padEnd(20)} ${a.roomNo} -> ${del.status}`,
      );
    }
  }

  if (failures) {
    console.error(`\nRESULT: ${failures} categor${failures === 1 ? "y" : "ies"} could not take a new room.`);
    process.exit(1);
  }
  console.log(`\nRESULT: all ${setup.data.length} categories accepted a new room and listed it back.`);
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
