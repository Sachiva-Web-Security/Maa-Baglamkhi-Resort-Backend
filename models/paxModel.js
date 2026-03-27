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

const addPax = (data, callback) => {
  const sql = `
    INSERT INTO pax
    (booking_id, adults, children, meal_plan)
    VALUES (?,?,?,?)
  `;

  db.query(sql, [data.booking_id, data.adults, data.children, data.mealPlan], callback);
};

module.exports = {
  ensureSchema,
  addPax,
};
