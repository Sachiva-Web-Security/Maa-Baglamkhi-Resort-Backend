const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS pax (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      room_number VARCHAR(50) DEFAULT NULL,
      adults INT NOT NULL DEFAULT 1,
      children INT NOT NULL DEFAULT 0,
      meal_plan VARCHAR(100) DEFAULT NULL
    )
  `);
};

const addPax = async (data, callback) => {
  const bookingId = Number(data.booking_id);
  const rows = Array.isArray(data.rows) && data.rows.length
    ? data.rows
    : [
        {
          roomNumber: data.roomNumber || null,
          adults: data.adults,
          children: data.children,
          mealPlan: data.mealPlan,
        },
      ];

  if (!bookingId) {
    callback(new Error("Booking ID required"));
    return;
  }

  try {
    for (const row of rows) {
      const roomNumber = String(row.roomNumber || "").trim() || null;
      const adults = Number(row.adults || 0);
      const children = Number(row.children || 0);
      const mealPlan = row.mealPlan || data.mealPlan || null;

      if (roomNumber) {
        const existingRows = await runQuery(
          "SELECT id FROM pax WHERE booking_id = ? AND room_number = ? ORDER BY id DESC LIMIT 1",
          [bookingId, roomNumber],
        );

        if (existingRows.length) {
          await runQuery(
            "UPDATE pax SET adults = ?, children = ?, meal_plan = ? WHERE id = ?",
            [adults, children, mealPlan, existingRows[0].id],
          );
          continue;
        }
      }

      await runQuery(
        "INSERT INTO pax (booking_id, room_number, adults, children, meal_plan) VALUES (?,?,?,?,?)",
        [bookingId, roomNumber, adults, children, mealPlan],
      );
    }

    callback(null, { success: true, count: rows.length });
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  ensureSchema,
  addPax,
};
