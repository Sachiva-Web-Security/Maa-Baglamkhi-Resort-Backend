const db = require("../config/db");

// ✅ 1. Room Types
exports.getRoomTypes = async (req, res) => {
  try {
   const [types] = await db.promise().query(`
  SELECT
    id,
    name,
    CAST(base_price AS DECIMAL(10,2)) AS base_price
  FROM room_categories
`);

    res.json({ success: true, types });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 2. Available Rooms
exports.getAvailableRooms = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        message: "checkIn and checkOut required"
      });
    }

   const [rooms] = await db.promise().query(`
  SELECT 
    r.id,
    r.room_number,
    c.name AS room_type,
    c.base_price AS price,
    r.status,
    r.check_in,
    r.check_out
  FROM hotel_room_inventory r
  JOIN room_categories c ON r.category_id = c.id
  WHERE (
    r.status = 'Available'   -- ✅ ADD THIS
    AND (
      r.check_in IS NULL
      OR r.check_out IS NULL
      OR NOT (r.check_in <= ? AND r.check_out >= ?)
    )
  )
`, [checkOut, checkIn]);
    // ✅ यह missing था
    res.json({ success: true, count: rooms.length, rooms });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 3. Room Price
exports.getRoomPrice = async (req, res) => {
  try {
    const [room] = await db.promise().query(`
      SELECT
        c.base_price AS price,
        c.name AS room_type
      FROM hotel_room_inventory r
      JOIN room_categories c ON r.category_id = c.id
      WHERE r.id = ?
    `, [req.params.roomId]);

    if (room.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json(room[0]);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};