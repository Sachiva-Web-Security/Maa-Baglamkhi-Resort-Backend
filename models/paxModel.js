const db = require("../config/db");

const addPax = (data, callback) => {
  const sql = `
    INSERT INTO pax
    (booking_id, adults, children, meal_plan)
    VALUES (?,?,?,?)
  `;

  db.query(
    sql,
    [
      data.booking_id,
      data.adults,
      data.children,
      data.mealPlan,
    ],
    callback
  );
};

module.exports = {
  addPax,
};