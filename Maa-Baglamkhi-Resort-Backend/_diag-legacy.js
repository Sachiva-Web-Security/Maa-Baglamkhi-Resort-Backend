require("dotenv").config({ quiet: true });
const db = require("./src/config/db");
const q = async (sql, p = []) => (await db.query(sql, p))[0];
(async () => {
  try {
    console.log("--- bookings referencing each category ---");
    console.table(await q(`SELECT br.category_id, COUNT(*) n FROM booking_rooms br GROUP BY br.category_id`));
    console.log("\n--- who created 'Deluxe' (id 1)? check schema seed ---");
    console.table(await q(`SELECT id, name, slug, default_price, unit_label, is_active, created_at FROM room_categories WHERE id = 1`));
    console.log("\n--- room 101 details ---");
    console.table(await q(`SELECT id, category_id, room_number, status, current_booking_id, notes, created_at FROM rooms WHERE room_number='101'`));
    console.log("\n--- is room 101 on any booking? ---");
    console.table(await q(`SELECT br.booking_id, r.room_number, b.status, b.check_in, b.check_out FROM booking_rooms br JOIN rooms r ON r.id=br.room_id JOIN bookings b ON b.id=br.booking_id WHERE r.room_number='101'`));
  } catch (e) { console.error("ERR:", e.message); }
  finally { await db.end(); process.exit(0); }
})();
