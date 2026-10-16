// Replay the NEW setRoomCatalog logic against the live payload and confirm every
// card gets a real backend id and the matching rooms.
const setupRows = JSON.parse(require("fs").readFileSync("setup.json", "utf8"));

const DEFAULT_ROOMS = [
  { id: 2, name: "NON-AC ROOM",          defaultPrice: 1500, unitLabel: "PER NIGHT" },
  { id: 3, name: "SUPER DELUXE ROOM",    defaultPrice: 3000, unitLabel: "PER NIGHT" },
  { id: 4, name: "EXECUTIVE ROOM ",      defaultPrice: 4000, unitLabel: "PER NIGHT" },
  { id: 5, name: "SUPER EXECUTIVE ROOM", defaultPrice: 5000, unitLabel: "PER NIGHT" },
  { id: 6, name: "SUITE ROOM",           defaultPrice: 800,  unitLabel: "PER BED"   },
];

// prev = the initial DEFAULT_ROOMS state (what the old code shipped)
const prev = DEFAULT_ROOMS;

// ---- NEW logic (mirrors the edit to Room.jsx) ----
const usedPrevIds = new Set();
const next = setupRows.map((category) => {
  const prevMatch = prev.find(
    (room) => Number(room.id) === Number(category.id) || room.name === category.name,
  );
  const id = prevMatch ? prevMatch.id : Number(category.id);
  usedPrevIds.add(String(id));
  const fallback = DEFAULT_ROOMS.find((d) => d.name === category.name);
  return {
    id,
    name: category.name,
    defaultPrice: Number(category.defaultPrice ?? fallback?.defaultPrice ?? 0),
    unitLabel: category.unitLabel || fallback?.unitLabel || "PER NIGHT",
  };
});
const orphaned = prev.filter((room) => !usedPrevIds.has(String(room.id)));
const catalog = [...next, ...orphaned];

// ---- OLD logic (for contrast) ----
const oldCatalog = prev.map((room) => {
  const backendCat = setupRows.find(
    (item) => Number(item.id) === Number(room.id) || item.name === room.name,
  );
  return backendCat
    ? { ...room, defaultPrice: Number(backendCat.defaultPrice || room.defaultPrice), unitLabel: backendCat.unitLabel || room.unitLabel }
    : room;
});

const mappedOptions = {};
setupRows.forEach((c) => { mappedOptions[c.id] = Array.isArray(c.rooms) ? c.rooms : []; });
const realIds = new Set(setupRows.map((c) => String(c.id)));

console.log("=== OLD behaviour (before fix) ===");
for (const card of oldCatalog) {
  const rooms = mappedOptions[card.id];
  const fkOk = realIds.has(String(card.id));
  console.log(`  id=${card.id} ${card.name.padEnd(21)} rooms=${rooms ? rooms.length + " shown" : "NONE (empty dropdown)"}  add_room=${fkOk ? "works" : "FAILS foreign key"}`);
}

console.log("\n=== NEW behaviour (after fix) ===");
let allOk = true;
for (const card of catalog) {
  const rooms = mappedOptions[card.id];
  const fkOk = realIds.has(String(card.id));
  const ok = fkOk && Array.isArray(rooms);
  if (!ok) allOk = false;
  console.log(`  id=${card.id} ${String(card.name).padEnd(21)} rooms=${Array.isArray(rooms) ? rooms.length + " shown" : "NONE"}  add_room=${fkOk ? "works" : "FAILS"}`);
}

console.log("\n=== Backend categories missing from the OLD UI ===");
const oldIds = new Set(oldCatalog.map((c) => String(c.id)));
for (const c of setupRows) {
  if (!oldIds.has(String(c.id))) console.log(`  MISSING id=${c.id} "${c.name}" (${c.rooms.length} rooms) -> now fixed`);
}

console.log(`\nRESULT: ${allOk ? "every card has a real id and a usable room list" : "STILL BROKEN"}`);
process.exit(allOk ? 0 : 1);
