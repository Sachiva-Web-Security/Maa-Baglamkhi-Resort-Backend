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
// v4: categories live in `room_categories`, rooms in `rooms`. This bootstrap is
// idempotent and only seeds anything missing.
const CATEGORY_SLUG = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ensureSchema = async () => {
  if (!(await tableExists("room_categories"))) return;

  // Keep the default room categories present across repeated starts.
  //
  // The explicit ids in DEFAULT_CATEGORIES are a seeding hint only — the live
  // table already holds these categories under its own ids (1 and 9003..9008),
  // and `slug` is what actually makes this idempotent. Matching on id here
  // would either duplicate every category or, worse, rewrite an unrelated row
  // that happens to own id 2..6.
  for (const category of DEFAULT_CATEGORIES) {
    await runQuery(
      `INSERT INTO room_categories (name, slug, default_price, unit_label, is_active)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         name         = VALUES(name),
         default_price = CASE
           WHEN COALESCE(default_price, 0) = 0 THEN VALUES(default_price)
           ELSE default_price
         END,
         unit_label   = COALESCE(NULLIF(unit_label, ''), VALUES(unit_label))`,
      [category.name, CATEGORY_SLUG(category.name), category.defaultPrice, category.unitLabel],
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
    FROM room_categories
    ORDER BY id
  `);

  // v4: operational state lives on `rooms`; occupancy is derived from
  // booking_rooms below when a date range is supplied.
  const rooms = await runQuery(`
    SELECT
      id,
      category_id                   AS categoryId,
      room_number                   AS roomNumber,
      COALESCE(status, 'available') AS status,
      NULL                          AS guest,
      NULL                          AS checkIn,
      NULL                          AS checkOut
    FROM rooms
    ORDER BY CAST(room_number AS UNSIGNED), room_number
  `);

  const selectedCheckIn = normalizeDateValue(checkIn);
  const selectedCheckOut = normalizeDateValue(checkOut) || selectedCheckIn;

  const occupiedRows =
    selectedCheckIn && selectedCheckOut
      ? await runQuery(
          `
            SELECT
              CAST(r.room_number AS CHAR) AS roomNumber,
              COALESCE(
                NULLIF((
                  SELECT TRIM(CONCAT(COALESCE(gp.first_name, ''), ' ', COALESCE(gp.last_name, '')))
                  FROM booking_guests bg
                  LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
                  WHERE bg.booking_id = b.id AND bg.is_primary = 1
                  LIMIT 1
                ), ''),
                NULLIF(br.guest_name, ''),
                'Guest'
              ) AS guest,
              DATE_FORMAT(b.check_in, '%Y-%m-%d') AS checkIn,
              DATE_FORMAT(b.check_out, '%Y-%m-%d') AS checkOut,
              'Occupied' AS status
            FROM booking_rooms br
            INNER JOIN bookings b ON b.id = br.booking_id
            INNER JOIN rooms r ON r.id = br.room_id
            WHERE LOWER(COALESCE(b.status, 'confirmed')) NOT IN ('checked_out', 'cancelled')
              AND DATE(COALESCE(b.check_in, ?)) <= DATE(?)
              AND DATE(COALESCE(b.check_out, ?)) >= DATE(?)
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
/**
 * Create a room under a category.
 *
 * ROOT CAUSE (issue 2 — "rooms in Duplex / Classic / other types won't add"):
 * `rooms.category_id` is a foreign key onto `room_categories.id`. The room
 * screens used to be driven by a hard-coded catalogue whose ids (2..6) do not
 * exist in this database, whose real ids are 1 and 9003..9008. Posting one of
 * those stale ids violated the FK, MySQL raised ER_NO_REFERENCED_ROW_2, and the
 * controller flattened every failure to a blanket 500 "Failed to add room" —
 * so the UI showed a generic failure with no hint that the room *type* was the
 * problem. Rooms under a valid category saved fine all along.
 *
 * Now the category is resolved (and, when the id is unknown, matched by name)
 * before the insert, so the caller gets a specific, actionable error instead of
 * a mystery 500.
 */
const addRoom = async ({ categoryId, category_id, categoryName, roomNumber }) => {
  await ensureSchema();

  const roomNo = String(roomNumber || "").trim();
  if (!roomNo) {
    const err = new Error("Room number is required");
    err.statusCode = 400;
    throw err;
  }

  // Resolve the category: prefer a valid id, else fall back to a name match.
  const categories = await runQuery(
    "SELECT id, name FROM room_categories WHERE is_active = 1 ORDER BY id",
  );

  const wantedId = categoryId ?? category_id;
  let resolved = wantedId
    ? categories.find((c) => String(c.id) === String(wantedId))
    : null;

  if (!resolved && categoryName) {
    resolved = categories.find(
      (c) =>
        String(c.name || "").trim().toLowerCase() ===
        String(categoryName).trim().toLowerCase(),
    );
  }

  if (!resolved) {
    const err = new Error(
      wantedId
        ? `Unknown room type (category id ${wantedId}). Pick a room type from the list and try again.`
        : "Room type is required. Pick a room type before adding a room.",
    );
    err.statusCode = 400;
    throw err;
  }

  // Mirror the real constraint. `rooms` carries UNIQUE KEY uniq_room_number on
  // room_number alone — a room number is unique across the WHOLE inventory, not
  // per category — so the check is global and compares the full identifier
  // ("N104" and "T104" are different rooms; "104" twice is not).
  const duplicate = await runQuery(
    `SELECT r.id, c.name AS categoryName
       FROM rooms r
       LEFT JOIN room_categories c ON c.id = r.category_id
      WHERE CAST(r.room_number AS CHAR) = CAST(? AS CHAR)
      LIMIT 1`,
    [roomNo],
  );
  if (duplicate.length) {
    const owner = duplicate[0].categoryName;
    const err = new Error(
      owner
        ? `Room ${roomNo} already exists under ${owner}. Room numbers must be unique.`
        : `Room ${roomNo} already exists. Room numbers must be unique.`,
    );
    err.statusCode = 409;
    err.code = "ER_DUP_ENTRY";
    throw err;
  }

  // runQuery resolves with mysql2's OkPacket for a write, which is an object
  // (not an array) — destructuring it as [result] throws
  // "(intermediate value) is not iterable", which the controller turns into a
  // blanket "Failed to add room" and hid the real cause.
  const result = await runQuery(
    "INSERT INTO rooms (category_id, room_number) VALUES (?, ?)",
    [Number(resolved.id), roomNo],
  );
  return {
    id:           result.insertId,
    categoryId:   Number(resolved.id),
    categoryName: resolved.name,
    roomNumber:   roomNo,
    status:       "available",
  };
};

// ─── deleteRoom ────────────────────────────────────────────────────────────────
// Removes a room from the inventory by room number.
const deleteRoom = async ({ roomNumber }) => {
  await ensureSchema();
  const num = String(roomNumber || "").trim();
  if (!num) {
    throw new Error("Room number is required");
  }
  const [result] = await new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM rooms WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)",
      [num],
      (error, result) => {
        if (error) { reject(error); return; }
        resolve([result]);
      },
    );
  });
  if (result.affectedRows === 0) {
    throw new Error("Room not found in inventory");
  }
  return { roomNumber: num };
};

// ─── updateCategoryPrice ──────────────────────────────────────────────────────
const updateCategoryPrice = async ({ categoryId, defaultPrice }) => {
  await ensureSchema();
  await runQuery(
    "UPDATE room_categories SET default_price = ? WHERE id = ?",
    [Number(defaultPrice) || 0, categoryId],
  );
};

// v4 `rooms.status` is an enum; map the display strings used by callers.
const ROOM_STATUS_ENUM = {
  available: "available",
  occupied: "occupied",
  cleaning: "cleaning",
  "occupied dirty": "cleaning",
  "vacant dirty": "cleaning",
  "vacant clean": "available",
  blocked: "out_of_service",
  maintenance: "out_of_service",
  outofservice: "out_of_service",
  reserved: "reserved",
};

const toRoomStatusEnum = (status) => {
  const key = String(status || "").trim().toLowerCase();
  return ROOM_STATUS_ENUM[key] || "available";
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
  if (!(await tableExists("rooms"))) return;

  await runQuery(
    `UPDATE rooms
     SET status = ?
     WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)`,
    [toRoomStatusEnum(status), roomNumber],
  );
};

// ─── validateRoomAvailability ──────────────────────────────────────────────────
// Checks whether the given rooms are available for the provided date range.
// Returns { available: true } or { available: false, conflicts: [...] }.
const validateRoomAvailability = async ({ roomNumbers, checkIn, checkOut, excludeBookingId = null }) => {
  await ensureSchema();
  const safeCheckIn = normalizeDateValue(checkIn);
  const safeCheckOut = normalizeDateValue(checkOut) || safeCheckIn;

  if (!safeCheckIn || !safeCheckOut || !roomNumbers || !roomNumbers.length) {
    return { available: true, conflicts: [] };
  }

  const conflicts = [];
  const uniqueRooms = [...new Set(roomNumbers.map((r) => String(r || "").trim()).filter(Boolean))];

  for (const roomNumber of uniqueRooms) {
    const overlapping = await runQuery(
      `
        SELECT
          b.id AS bookingId,
          b.booking_code AS bookingCode,
          COALESCE(
            NULLIF((
              SELECT TRIM(CONCAT(COALESCE(gp.first_name, ''), ' ', COALESCE(gp.last_name, '')))
              FROM booking_guests bg
              LEFT JOIN guest_profiles gp ON gp.id = bg.guest_profile_id
              WHERE bg.booking_id = b.id AND bg.is_primary = 1
              LIMIT 1
            ), ''),
            NULLIF(br.guest_name, ''),
            'Guest'
          ) AS guest_name,
          b.check_in,
          b.check_out,
          b.status AS booking_status,
          CAST(r.room_number AS CHAR) AS room_number
        FROM booking_rooms br
        INNER JOIN bookings b ON b.id = br.booking_id
        INNER JOIN rooms r ON r.id = br.room_id
        WHERE LOWER(COALESCE(b.status, 'confirmed')) NOT IN ('checked_out', 'cancelled')
          AND CAST(r.room_number AS CHAR) = ?
          AND DATE(COALESCE(b.check_in, ?)) <= DATE(?)
          AND DATE(COALESCE(b.check_out, ?)) >= DATE(?)
          ${excludeBookingId ? "AND b.id <> ?" : ""}
        LIMIT 1
      `,
      excludeBookingId
        ? [roomNumber, safeCheckIn, safeCheckOut, safeCheckOut, safeCheckIn, excludeBookingId]
        : [roomNumber, safeCheckIn, safeCheckOut, safeCheckOut, safeCheckIn],
    );

    if (overlapping.length > 0) {
      conflicts.push({
        roomNumber,
        ...overlapping[0],
      });
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts,
  };
};

module.exports = {
  ensureSchema,
  getRoomSetup,
  addRoom,
  deleteRoom,
  updateCategoryPrice,
  updateRoomOperationalState,
  validateRoomAvailability,
};
