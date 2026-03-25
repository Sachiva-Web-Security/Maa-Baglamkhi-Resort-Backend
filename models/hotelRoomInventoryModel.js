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

const tableExists = async (tableName) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows.length > 0;
};

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
      guest VARCHAR(200) DEFAULT NULL,
      status VARCHAR(60) DEFAULT 'Available',
      check_in DATE DEFAULT NULL,
      check_out DATE DEFAULT NULL,
      block_reason VARCHAR(255) DEFAULT NULL,
      block_from DATE DEFAULT NULL,
      block_to DATE DEFAULT NULL,
      block_notes TEXT DEFAULT NULL,
      blocked_by VARCHAR(120) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_hotel_room_inventory_category
      FOREIGN KEY (category_id) REFERENCES hotel_room_categories(id)
      ON DELETE CASCADE
    )
  `);

  for (const [column, definition] of [
    ["guest", "VARCHAR(200) DEFAULT NULL"],
    ["status", "VARCHAR(60) DEFAULT 'Available'"],
    ["check_in", "DATE DEFAULT NULL"],
    ["check_out", "DATE DEFAULT NULL"],
    ["block_reason", "VARCHAR(255) DEFAULT NULL"],
    ["block_from", "DATE DEFAULT NULL"],
    ["block_to", "DATE DEFAULT NULL"],
    ["block_notes", "TEXT DEFAULT NULL"],
    ["blocked_by", "VARCHAR(120) DEFAULT NULL"],
  ]) {
    const exists = await columnExists("hotel_room_inventory", column);
    if (!exists) {
      await runQuery(`ALTER TABLE hotel_room_inventory ADD COLUMN ${column} ${definition}`);
    }
  }

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
      room_number AS roomNumber,
      status,
      block_reason AS blockReason,
      DATE(block_from) AS blockFrom,
      DATE(block_to) AS blockTo,
      block_notes AS blockNotes,
      blocked_by AS blockedBy
    FROM hotel_room_inventory
    ORDER BY CAST(room_number AS UNSIGNED), room_number
  `);

  return categories.map((category) => ({
    ...category,
    rooms: rooms
      .filter((room) => Number(room.categoryId) === Number(category.id))
      .map((room) => room.roomNumber),
    roomDetails: rooms.filter((room) => Number(room.categoryId) === Number(category.id)),
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

const updateRoomOperationalState = async ({
  roomNumber,
  guestName = null,
  status,
  checkIn = null,
  checkOut = null,
  blockReason = null,
  blockFrom = null,
  blockTo = null,
  blockNotes = null,
  blockedBy = null,
}) => {
  await ensureSchema();
  const updates = [];
  const nextStatus = String(status || "").trim();
  const isBlocked = nextStatus.toLowerCase().includes("blocked") || nextStatus.toLowerCase().includes("out of service");
  const nextGuest = isBlocked ? null : guestName;
  const nextCheckIn = isBlocked ? null : checkIn;
  const nextCheckOut = isBlocked ? null : checkOut;
  const nextBlockReason = isBlocked ? blockReason : null;
  const nextBlockFrom = isBlocked ? blockFrom : null;
  const nextBlockTo = isBlocked ? blockTo : null;
  const nextBlockNotes = isBlocked ? blockNotes : null;
  const nextBlockedBy = isBlocked ? blockedBy : null;

  if (await tableExists("hotel_room_inventory")) {
    updates.push(
      runQuery(
        `
          UPDATE hotel_room_inventory
          SET guest = ?, status = ?, check_in = ?, check_out = ?,
              block_reason = ?, block_from = ?, block_to = ?, block_notes = ?, blocked_by = ?
          WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)
        `,
        [
          nextGuest,
          nextStatus,
          nextCheckIn,
          nextCheckOut,
          nextBlockReason,
          nextBlockFrom,
          nextBlockTo,
          nextBlockNotes,
          nextBlockedBy,
          roomNumber,
        ],
      ),
    );
  }

  if (await tableExists("rooms")) {
    updates.push(
      runQuery(
        `
          UPDATE rooms
          SET guest = ?, status = ?, check_in = ?, check_out = ?
          WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)
        `,
        [guestName, status, checkIn, checkOut, roomNumber],
      ),
    );
  }

  await Promise.all(updates);
};

module.exports = {
  ensureSchema,
  getRoomSetup,
  addRoom,
  updateCategoryPrice,
  updateRoomOperationalState,
};
