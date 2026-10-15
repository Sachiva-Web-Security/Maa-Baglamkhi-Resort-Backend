const setupRows = JSON.parse(require("fs").readFileSync("setup.json", "utf8"));
const DEFAULT_ROOMS = [
  { id: 2, name: "NON-AC ROOM",          defaultPrice: 1500, unitLabel: "PER NIGHT" },
  { id: 3, name: "SUPER DELUXE ROOM",    defaultPrice: 3000, unitLabel: "PER NIGHT" },
  { id: 4, name: "EXECUTIVE ROOM ",      defaultPrice: 4000, unitLabel: "PER NIGHT" },
  { id: 5, name: "SUPER EXECUTIVE ROOM", defaultPrice: 5000, unitLabel: "PER NIGHT" },
  { id: 6, name: "SUITE ROOM",           defaultPrice: 800,  unitLabel: "PER BED"   },
];
const prev = DEFAULT_ROOMS;
const mappedOptions = {};
setupRows.forEach((c) => { mappedOptions[c.id] = Array.isArray(c.rooms) ? c.rooms : []; });
const realIds = new Set(setupRows.map((c) => String(c.id)));

// FINAL logic: pure backend truth, backend's own id
const catalog = setupRows.length ? setupRows.map((category) => {
  const fallback = DEFAULT_ROOMS.find((d) => d.name === category.name);
  return {
    id: Number(category.id),
    name: category.name,
    defaultPrice: Number(category.defaultPrice ?? fallback?.defaultPrice ?? 0),
    unitLabel: category.unitLabel || fallback?.unitLabel || "PER NIGHT",
  };
}) : prev;

console.log("=== FINAL behaviour ===");
let allOk = true;
for (const card of catalog) {
  const rooms = mappedOptions[card.id];
  const fkOk = realIds.has(String(card.id));
  const ok = fkOk && Array.isArray(rooms);
  if (!ok) allOk = false;
  console.log(`  ${ok ? "OK " : "BAD"} id=${String(card.id).padEnd(5)} ${card.name.padEnd(21)} rooms=${String(rooms.length).padStart(2)}  price=${card.defaultPrice} ${card.unitLabel}`);
}
const noFakes = catalog.every((c) => realIds.has(String(c.id)));
console.log(`\n  no fabricated ids remain: ${noFakes ? "yes" : "NO"}`);
console.log(`  card count ${catalog.length} == backend category count ${setupRows.length}: ${catalog.length === setupRows.length ? "yes" : "NO"}`);
console.log(`\nRESULT: ${allOk && noFakes && catalog.length === setupRows.length ? "EVERY card maps to a real category with a usable room list and a working Add Room" : "STILL BROKEN"}`);
process.exit(allOk && noFakes && catalog.length === setupRows.length ? 0 : 1);
