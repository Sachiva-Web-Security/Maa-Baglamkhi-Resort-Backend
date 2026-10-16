require("dotenv").config({ quiet: true });
const API = "http://127.0.0.1:5002/api";
const call = async (m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: r.status, data: d };
};
(async () => {
  for (const rn of ["102", "103"]) {
    const r = await call("POST", "/hotel/rooms", { categoryId: 1, roomNumber: rn });
    console.log(`  ${r.status === 200 ? "+" : "!"} ${rn} -> Deluxe: ${r.status === 200 ? "added" : JSON.stringify(r.data)}`);
  }
  const s = await call("GET", "/hotel/rooms/setup");
  console.log("\nFinal inventory:");
  for (const c of s.data) console.log(`  ${c.rooms.length >= 3 ? "OK " : "LOW"} ${c.name.padEnd(20)} ${c.rooms.join(", ") || "-"}`);
  process.exit(0);
})();
