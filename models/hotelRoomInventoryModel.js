const db = require("../config/db");

const DEFAULT_CATEGORIES = [
  { id: 1, name: "AC ROOM", defaultPrice: 2000, unitLabel: "PER NIGHT" },
  { id: 2, name: "NON-AC ROOM", defaultPrice: 1500, unitLabel: "PER NIGHT" },
  { id: 3, name: "DELUXE ROOM", defaultPrice: 3000, unitLabel: "PER NIGHT" },
  { id: 4, name: "SUPER DELUXE ROOM", defaultPrice: 4000, unitLabel: "PER NIGHT" },
  { id: 5, name: "SUITE ROOM", defaultPrice: 5000, unitLabel: "PER NIGHT" },
  { id: 6, name: "DELUXE DORMITORY", defaultPrice: 800, unitLabel: "PER BED" },
];

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_room_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit_label VARCHAR(40) NOT NULL DEFAULT 'PER NIGHT',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_room_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      room_number VARCHAR(50) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_hotel_room_inventory_category
      FOREIGN KEY (category_id) REFERENCES hotel_room_categories(id)
      ON DELETE CASCADE
    )
  `);

  const categoryCount = await runQuery(
    "SELECT COUNT(*) AS count FROM hotel_room_categories",
  );

  if (!categoryCount[0]?.count) {
    for (const category of DEFAULT_CATEGORIES) {
      await runQuery(
        `
          INSERT INTO hotel_room_categories (id, name, default_price, unit_label)
          VALUES (?, ?, ?, ?)
        `,
        [category.id, category.name, category.defaultPrice, category.unitLabel],
      );
    }
  }
};

const getRoomSetup = async () => {
  await ensureSchema();

  const categories = await runQuery(`
    SELECT
      id,
      name,
      default_price AS defaultPrice,
      unit_label AS unitLabel
    FROM hotel_room_categories
    ORDER BY id
  `);

  const rooms = await runQuery(`
    SELECT
      id,
      category_id AS categoryId,
      room_number AS roomNumber
    FROM hotel_room_inventory
    ORDER BY CAST(room_number AS UNSIGNED), room_number
  `);

  return categories.map((category) => ({
    ...category,
    rooms: rooms
      .filter((room) => Number(room.categoryId) === Number(category.id))
      .map((room) => room.roomNumber),
  }));
};

const addRoom = async ({ categoryId, roomNumber }) => {
  await ensureSchema();
  const result = await runQuery(
    "INSERT INTO hotel_room_inventory (category_id, room_number) VALUES (?, ?)",
    [categoryId, String(roomNumber || "").trim()],
  );

  return {
    id: result.insertId,
    categoryId: Number(categoryId),
    roomNumber: String(roomNumber || "").trim(),
  };
};

const updateCategoryPrice = async ({ categoryId, defaultPrice }) => {
  await ensureSchema();
  await runQuery(
    "UPDATE hotel_room_categories SET default_price = ? WHERE id = ?",
    [Number(defaultPrice) || 0, categoryId],
  );
};

module.exports = {
  ensureSchema,
  getRoomSetup,
  addRoom,
  updateCategoryPrice,
};
