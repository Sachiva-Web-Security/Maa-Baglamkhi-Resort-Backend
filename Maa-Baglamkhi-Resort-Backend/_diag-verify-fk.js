require("dotenv").config({ quiet: true });
const API_BASE = "http://127.0.0.1:5002/api";
const call = async (m, p, b) => {
  const r = await fetch(API_BASE + p, { method: m, headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: r.status, data: d };
};
(async () => {
  const setup = await call("GET", "/hotel/rooms/setup");
  console.log("=== Add-room POST must succeed for EVERY real category id ===\n");
  for (const cat of setup.data) {
    // Probe with a temp room, then delete it.
    const probe = "PROBE-" + cat.id;
    const added = await call("POST", "/hotel/rooms", { categoryId: cat.id, roomNumber: probe });
    let ok = added.status === 200;
    if (ok) await call("DELETE", "/hotel/rooms/" + encodeURIComponent(probe));
    console.log(`  ${ok ? "OK " : "FAIL"} id=${cat.id} ${cat.name} -> ${ok ? "add works" : JSON.stringify(added.data)}`);
  }
  console.log("\n=== Old fake ids must FAIL (proving the root cause) ===");
  for (const fake of [2, 3, 4, 5, 6]) {
    const added = await call("POST", "/hotel/rooms", { categoryId: fake, roomNumber: "PROBE-FAKE-" + fake });
    console.log(`  ${added.status === 200 ? "unexpected OK" : "fails as expected"} id=${fake} -> ${added.status} ${JSON.stringify(added.data).slice(0,90)}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
