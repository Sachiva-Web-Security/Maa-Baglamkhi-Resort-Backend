require("dotenv").config({ quiet: true });
const db = require("./src/config/db");
const q = async (sql, p = []) => (await db.query(sql, p))[0];
const show = (label, r) => { console.log("\n=== " + label + " ==="); console.table(r); };
(async () => {
  try {
    const cats = await q("SELECT id, name, slug, default_price, unit_label, is_active FROM room_categories ORDER BY id");
    const rooms = await q("SELECT id, category_id, room_number, status FROM rooms ORDER BY category_id, room_number");
    show("categories", cats);
    show("rooms", rooms);
    const counts = await q(`SELECT c.id, c.name, COUNT(r.id) AS room_count
      FROM room_categories c LEFT JOIN rooms r ON r.category_id = c.id
      GROUP BY c.id, c.name ORDER BY c.id`);
    show("rooms per category", counts);
    show("next auto-increment for rooms", await q("SHOW TABLE STATUS LIKE 'rooms'").then(r => r.map(x => ({Auto_increment: x.Auto_increment}))));
  } catch (e) { console.error("ERR:", e.message); }
  finally { await db.end(); process.exit(0); }
})();
