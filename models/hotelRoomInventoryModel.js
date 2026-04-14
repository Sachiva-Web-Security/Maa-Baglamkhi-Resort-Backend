// models/hotelRoomInventoryModel.js
const db = require("../config/db");

const DEFAULT_CATEGORIES = [
  { id: 1, name: "AC ROOM",           defaultPrice: 2000, unitLabel: "PER NIGHT" },
  { id: 2, name: "NON-AC ROOM",       defaultPrice: 1500, unitLabel: "PER NIGHT" },
  { id: 3, name: "DELUXE ROOM",       defaultPrice: 3000, unitLabel: "PER NIGHT" },
  { id: 4, name: "SUPER DELUXE ROOM", defaultPrice: 4000, unitLabel: "PER NIGHT" },
  { id: 5, name: "SUITE ROOM",        defaultPrice: 5000, unitLabel: "PER NIGHT" },
  { id: 6, name: "DELUXE DORMITORY",  defaultPrice: 800,  unitLabel: "PER BED"   },
];

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) { reject(error); return; }
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

const normalizeDateValue = (value) => {
  if (!value) return null;
  const text = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

// ─── Schema bootstrap ──────────────────────────────────────────────────────────
const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_room_categories (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      name         VARCHAR(120) NOT NULL UNIQUE,
      default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
      unit_label   VARCHAR(40)  NOT NULL DEFAULT 'PER NIGHT',
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_room_inventory (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      room_number VARCHAR(50) NOT NULL UNIQUE,
      guest       VARCHAR(200) DEFAULT NULL,
      status      VARCHAR(60)  DEFAULT 'Available',
      check_in    DATE DEFAULT NULL,
      check_out   DATE DEFAULT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_hotel_room_inventory_category
        FOREIGN KEY (category_id) REFERENCES hotel_room_categories(id)
        ON DELETE CASCADE
    )
  `);

  // Add missing columns if needed
  for (const [column, definition] of [
    ["guest",     "VARCHAR(200) DEFAULT NULL"],
    ["status",    "VARCHAR(60) DEFAULT 'Available'"],
    ["check_in",  "DATE DEFAULT NULL"],
    ["check_out", "DATE DEFAULT NULL"],
  ]) {
    const exists = await columnExists("hotel_room_inventory", column);
    if (!exists) {
      await runQuery(`ALTER TABLE hotel_room_inventory ADD COLUMN ${column} ${definition}`);
    }
  }

  // Keep the default room categories present across repeated test resets.
  for (const category of DEFAULT_CATEGORIES) {
    await runQuery(
      `INSERT INTO hotel_room_categories (id, name, default_price, unit_label)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         default_price = VALUES(default_price),
         unit_label = VALUES(unit_label)`,
      [category.id, category.name, category.defaultPrice, category.unitLabel],
    );
  }
};

// ─── getRoomSetup — returns categories with rooms + status ────────────────────
// BUG FIX: now returns room status, guest, checkIn, checkOut for each room
// so Room.jsx can correctly mark Occupied/Blocked rooms as unavailable.
const getRoomSetup = async ({ checkIn = null, checkOut = null } = {}) => {
  await ensureSchema();

  const categories = await runQuery(`
    SELECT
      id,
      name,
      default_price AS defaultPrice,
      unit_label    AS unitLabel
    FROM hotel_room_categories
    ORDER BY id
  `);

  // FIX: include status, guest, check_in, check_out so frontend knows room state
  const rooms = await runQuery(`
    SELECT
      id,
      category_id                           AS categoryId,
      room_number                           AS roomNumber,
      COALESCE(status, 'Available')         AS status,
      guest,
      check_in                              AS checkIn,
      check_out                             AS checkOut
    FROM hotel_room_inventory
    ORDER BY CAST(room_number AS UNSIGNED), room_number
  `);

  const selectedCheckIn = normalizeDateValue(checkIn);
  const selectedCheckOut = normalizeDateValue(checkOut) || selectedCheckIn;

  const occupiedRows =
    selectedCheckIn && selectedCheckOut
      ? await runQuery(
          `
            SELECT
              CAST(rt.room_number AS CHAR) AS roomNumber,
              g.guest_name AS guest,
              DATE_FORMAT(g.check_in, '%Y-%m-%d') AS checkIn,
              DATE_FORMAT(g.check_out, '%Y-%m-%d') AS checkOut,
              'Occupied' AS status
            FROM guests g
            INNER JOIN room_tariff rt ON rt.booking_id = g.id
            WHERE LOWER(COALESCE(g.booking_status, 'confirmed')) NOT IN ('checked out', 'cancelled')
              AND DATE(COALESCE(g.check_in, ?)) <= DATE(?)
              AND DATE(COALESCE(g.check_out, ?)) >= DATE(?)
          `,
          [selectedCheckIn, selectedCheckOut, selectedCheckOut, selectedCheckIn],
        )
      : [];

  const occupiedByRoom = new Map(
    occupiedRows.map((row) => [
      String(row.roomNumber || "").trim(),
      {
        status: "Occupied",
        guest: row.guest || null,
        checkIn: row.checkIn || null,
        checkOut: row.checkOut || null,
      },
    ]),
  );

  return categories.map((category) => {
    const categoryRooms = rooms.filter(
      (room) => Number(room.categoryId) === Number(category.id),
    );

    return {
      ...category,
      // Backward-compatible: keep as string array for any existing code that uses it
      rooms: categoryRooms.map((room) => room.roomNumber),

      // NEW: full room objects with status — used by Room.jsx availability logic
      roomDetails: categoryRooms.map((room) => {
        const occupiedRoom = occupiedByRoom.get(String(room.roomNumber || "").trim());
        const resolvedRoom = occupiedRoom
          ? {
              ...room,
              status: occupiedRoom.status,
              guest: occupiedRoom.guest,
              checkIn: occupiedRoom.checkIn,
              checkOut: occupiedRoom.checkOut,
            }
          : room;

        return {
          roomNumber: resolvedRoom.roomNumber,
          status: resolvedRoom.status || "Available",
          guest: resolvedRoom.guest || null,
          checkIn: resolvedRoom.checkIn || null,
          checkOut: resolvedRoom.checkOut || null,
        };
      }),
    };
  });
};

// ─── addRoom ──────────────────────────────────────────────────────────────────
const addRoom = async ({ categoryId, roomNumber }) => {
  await ensureSchema();
  const result = await runQuery(
    "INSERT INTO hotel_room_inventory (category_id, room_number) VALUES (?, ?)",
    [categoryId, String(roomNumber || "").trim()],
  );
  return {
    id:          result.insertId,
    categoryId:  Number(categoryId),
    roomNumber:  String(roomNumber || "").trim(),
    status:      "Available",
  };
};

// ─── updateCategoryPrice ──────────────────────────────────────────────────────
const updateCategoryPrice = async ({ categoryId, defaultPrice }) => {
  await ensureSchema();
  await runQuery(
    "UPDATE hotel_room_categories SET default_price = ? WHERE id = ?",
    [Number(defaultPrice) || 0, categoryId],
  );
};

// ─── updateRoomOperationalState ───────────────────────────────────────────────
// Called on check-in, check-out, and maintenance block/release.
const updateRoomOperationalState = async ({
  roomNumber,
  guestName = null,
  status,
  checkIn   = null,
  checkOut  = null,
}) => {
  await ensureSchema();

  const updates = [];

  if (await tableExists("hotel_room_inventory")) {
    updates.push(
      runQuery(
        `UPDATE hotel_room_inventory
         SET guest = ?, status = ?, check_in = ?, check_out = ?
         WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)`,
        [guestName, status, checkIn, checkOut, roomNumber],
      ),
    );
  }

  // Also update legacy `rooms` table if it exists
  if (await tableExists("rooms")) {
    updates.push(
      runQuery(
        `UPDATE rooms
         SET guest = ?, status = ?, check_in = ?, check_out = ?
         WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)`,
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
