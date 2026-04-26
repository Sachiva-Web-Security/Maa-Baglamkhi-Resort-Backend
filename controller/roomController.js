const db = require("../config/db");

const CATEGORY_AVAILABILITY_SQL = `
  SELECT
    c.id AS category_id,
    c.name AS room_type,
    CAST(c.base_price AS DECIMAL(10,2)) AS price,
    COUNT(r.id) AS total_rooms,
    SUM(
      CASE
        WHEN r.status = 'Available'
          AND (
            r.check_in IS NULL
            OR r.check_out IS NULL
            OR NOT (r.check_in <= ? AND r.check_out >= ?)
          )
        THEN 1
        ELSE 0
      END
    ) AS available_count
  FROM room_categories c
  LEFT JOIN hotel_room_inventory r ON r.category_id = c.id
  GROUP BY c.id, c.name, c.base_price
  ORDER BY c.id
`;

exports.getRoomTypes = async (_req, res) => {
  try {
    const [types] = await db.promise().query(`
      SELECT
        id,
        name,
        CAST(base_price AS DECIMAL(10,2)) AS base_price
      FROM room_categories
      ORDER BY id
    `);

    res.json({ success: true, types });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAvailableRooms = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        message: "checkIn and checkOut required",
      });
    }

    const [rooms] = await db.promise().query(
      `
        SELECT
          r.id,
          r.room_number,
          r.category_id,
          c.name AS room_type,
          CAST(c.base_price AS DECIMAL(10,2)) AS price,
          r.status,
          r.check_in,
          r.check_out
        FROM hotel_room_inventory r
        JOIN room_categories c ON r.category_id = c.id
        WHERE r.status = 'Available'
          AND (
            r.check_in IS NULL
            OR r.check_out IS NULL
            OR NOT (r.check_in <= ? AND r.check_out >= ?)
          )
        ORDER BY c.id, CAST(r.room_number AS UNSIGNED), r.room_number
      `,
      [checkOut, checkIn],
    );

    res.json({ success: true, count: rooms.length, rooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCategoryAvailability = async (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        message: "checkIn and checkOut required",
      });
    }

    const [categories] = await db.promise().query(CATEGORY_AVAILABILITY_SQL, [checkOut, checkIn]);

    const [availableRooms] = await db.promise().query(
      `
        SELECT
          r.id,
          r.room_number,
          r.category_id,
          c.name AS room_type,
          CAST(c.base_price AS DECIMAL(10,2)) AS price
        FROM hotel_room_inventory r
        INNER JOIN room_categories c ON c.id = r.category_id
        WHERE r.status = 'Available'
          AND (
            r.check_in IS NULL
            OR r.check_out IS NULL
            OR NOT (r.check_in <= ? AND r.check_out >= ?)
          )
        ORDER BY c.id, CAST(r.room_number AS UNSIGNED), r.room_number
      `,
      [checkOut, checkIn],
    );

    const roomsByCategory = availableRooms.reduce((map, room) => {
      const key = String(room.category_id);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push({
        id: Number(room.id),
        room_number: room.room_number,
        category_id: Number(room.category_id),
        room_type: room.room_type,
        price: Number(room.price || 0),
      });
      return map;
    }, new Map());

    const payload = categories.map((category) => ({
      categoryId: Number(category.category_id),
      roomType: category.room_type,
      price: Number(category.price || 0),
      totalRooms: Number(category.total_rooms || 0),
      availableCount: Number(category.available_count || 0),
      availableRooms: roomsByCategory.get(String(category.category_id)) || [],
    }));

    res.json({
      success: true,
      checkIn,
      checkOut,
      categories: payload,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRoomPrice = async (req, res) => {
  try {
    const [room] = await db.promise().query(
      `
        SELECT
          c.base_price AS price,
          c.name AS room_type
        FROM hotel_room_inventory r
        JOIN room_categories c ON r.category_id = c.id
        WHERE r.id = ?
      `,
      [req.params.roomId],
    );

    if (room.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json(room[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
