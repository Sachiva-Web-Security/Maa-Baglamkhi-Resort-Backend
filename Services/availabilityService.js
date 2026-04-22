const db = require("../config/db");

exports.getAvailableRooms = async (checkIn, checkOut) => {
  try {
    const [rooms] = await db.promise().query(`
      SELECT 
        r.id,
        r.room_number,
        c.name AS room_type,
        c.base_price AS price
      FROM hotel_room_inventory r
      JOIN room_categories c ON r.category_id = c.id
      WHERE NOT (
        r.check_in <= ? AND r.check_out >= ?
      )
    `, [checkOut, checkIn]);

    return rooms;

  } catch (err) {
    throw err;
  }
};