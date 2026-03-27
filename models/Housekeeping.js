const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
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

const mapHousekeepingToHotelStatus = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "vacant clean") return "Available";
  if (s === "vacant dirty") return "Cleaning";
  if (s === "cleaning in progress") return "Cleaning";
  if (s === "occupied dirty") return "Occupied";
  if (s === "out of service") return "Out of Service";

  return null;
};

const mapHotelStatusToHousekeeping = (status) => {
  const s = String(status || "").toLowerCase();

  if (s === "occupied") return "Occupied Dirty";
  if (s === "available") return "Vacant Clean";
  if (s === "vacant clean") return "Vacant Clean";
  if (s === "cleaning") return "Cleaning In Progress";
  if (s === "out of service") return "Out of Service";

  return "Vacant Clean";
};

const syncOperationalStatus = async (roomNo, housekeepingStatus) => {
  const hotelStatus = mapHousekeepingToHotelStatus(housekeepingStatus);
  if (!roomNo || !hotelStatus) return;

  const updates = [];

  if (await tableExists("hotel_room_inventory")) {
    updates.push(
      runQuery(
        `UPDATE hotel_room_inventory
         SET status = ?
         WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)`,
        [hotelStatus, roomNo],
      ),
    );
  }

  if (await tableExists("rooms")) {
    updates.push(
      runQuery(
        `UPDATE rooms
         SET status = ?
         WHERE CAST(room_number AS CHAR) = CAST(? AS CHAR)`,
        [hotelStatus, roomNo],
      ),
    );
  }

  await Promise.all(updates);
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS housekeeping (
      id INT NOT NULL AUTO_INCREMENT,
      roomNo VARCHAR(50) NOT NULL,
      status VARCHAR(100) NOT NULL DEFAULT 'Vacant Dirty',
      assignee VARCHAR(100) NOT NULL DEFAULT 'No Housekeeper',
      priority VARCHAR(50) NOT NULL DEFAULT 'Normal',
      notes TEXT NULL,
      cleaningStart DATETIME NULL,
      cleaningEnd DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_roomNo (roomNo)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS housekeeping_logs (
      id INT NOT NULL AUTO_INCREMENT,
      roomNo VARCHAR(50) NOT NULL,
      oldStatus VARCHAR(100) NULL,
      newStatus VARCHAR(100) NOT NULL,
      assignee VARCHAR(100) NULL,
      notes TEXT NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);
};

const Housekeeping = {
  ensureSchema,

  getAllRooms: async (callback) => {
    try {
      const hasRooms = await tableExists("rooms");
      const hasAssignments = await tableExists("assignments");
      const hasInventory = await tableExists("hotel_room_inventory");
      const hasHousekeepingPriority = await columnExists("housekeeping", "priority");
      const hasHousekeepingNotes = await columnExists("housekeeping", "notes");
      const hasHousekeepingCleaningStart = await columnExists("housekeeping", "cleaningStart");
      const hasHousekeepingCleaningEnd = await columnExists("housekeeping", "cleaningEnd");

      if (!hasRooms) {
        return callback(null, []);
      }

      const roomNumberColumn = (await columnExists("rooms", "room_number"))
        ? "room_number"
        : (await columnExists("rooms", "number"))
          ? "number"
          : null;
      const roomStatusColumn = (await columnExists("rooms", "status")) ? "status" : null;

      if (!roomNumberColumn) {
        return callback(null, []);
      }

      const roomsRoomNoExpr = `CAST(r.${roomNumberColumn} AS CHAR)`;
      const roomStatusExpr = roomStatusColumn ? `COALESCE(r.${roomStatusColumn}, 'available')` : "'available'";
      const housekeepingPriorityExpr = hasHousekeepingPriority
        ? "COALESCE(NULLIF(hk.priority, ''), 'Normal')"
        : "'Normal'";
      const housekeepingNotesExpr = hasHousekeepingNotes
        ? "COALESCE(hk.notes, '')"
        : "''";
      const housekeepingCleaningStartExpr = hasHousekeepingCleaningStart
        ? "hk.cleaningStart"
        : "NULL";
      const housekeepingCleaningEndExpr = hasHousekeepingCleaningEnd
        ? "hk.cleaningEnd"
        : "NULL";

      // sync rooms table -> housekeeping
      await runQuery(`
        INSERT INTO housekeeping (roomNo, status, assignee)
        SELECT
          ${roomsRoomNoExpr},
          CASE
            WHEN LOWER(${roomStatusExpr}) = 'occupied' THEN 'Occupied Dirty'
            WHEN LOWER(${roomStatusExpr}) = 'cleaning' THEN 'Cleaning In Progress'
            WHEN LOWER(${roomStatusExpr}) = 'out of service' THEN 'Out of Service'
            ELSE 'Vacant Clean'
          END,
          'No Housekeeper'
        FROM rooms r
        LEFT JOIN housekeeping hk
          ON CAST(hk.roomNo AS CHAR) = ${roomsRoomNoExpr}
        WHERE hk.id IS NULL
      `);

      let assignmentJoin = "";
      if (hasAssignments) {
        assignmentJoin = `
          LEFT JOIN (
            SELECT a1.room_number, a1.staff_name
            FROM assignments a1
            INNER JOIN (
              SELECT room_number, MAX(id) AS max_id
              FROM assignments
              GROUP BY room_number
            ) latest
              ON latest.room_number = a1.room_number
             AND latest.max_id = a1.id
          ) a ON CAST(a.room_number AS CHAR) = base.roomNo
        `;
      }

      let inventoryJoin = "";
      let inventoryStatusExpr = "base.roomStatus";
      let guestExpr = "NULL";
      let checkInExpr = "NULL";
      let checkOutExpr = "NULL";

      if (hasInventory) {
        inventoryJoin = `
          LEFT JOIN hotel_room_inventory hri
            ON CAST(hri.room_number AS CHAR) = base.roomNo
        `;
        inventoryStatusExpr = "COALESCE(hri.status, base.roomStatus)";
        guestExpr = "hri.guest";
        checkInExpr = "hri.check_in";
        checkOutExpr = "hri.check_out";
      }

      const baseRoomsSql = hasInventory
        ? `
          SELECT
            MIN(src.id) AS id,
            src.roomNo AS roomNo,
            MAX(src.roomStatus) AS roomStatus
          FROM (
            SELECT
              r.id AS id,
              ${roomsRoomNoExpr} AS roomNo,
              ${roomStatusExpr} AS roomStatus
            FROM rooms r
            UNION ALL
            SELECT
              hri.id AS id,
              CAST(hri.room_number AS CHAR) AS roomNo,
              COALESCE(hri.status, 'available') AS roomStatus
            FROM hotel_room_inventory hri
          ) src
          GROUP BY src.roomNo
        `
        : `
          SELECT
            r.id AS id,
            ${roomsRoomNoExpr} AS roomNo,
            ${roomStatusExpr} AS roomStatus
          FROM rooms r
        `;

      const rows = await runQuery(`
        SELECT
          COALESCE(hk.id, base.id) AS id,
          base.roomNo AS roomNo,
          COALESCE(
            NULLIF(hk.status, ''),
            CASE
              WHEN LOWER(${inventoryStatusExpr}) = 'occupied' THEN 'Occupied Dirty'
              WHEN LOWER(${inventoryStatusExpr}) = 'cleaning' THEN 'Cleaning In Progress'
              WHEN LOWER(${inventoryStatusExpr}) = 'out of service' THEN 'Out of Service'
              ELSE 'Vacant Clean'
            END
          ) AS status,
          COALESCE(NULLIF(hk.assignee, ''), NULLIF(a.staff_name, ''), 'No Housekeeper') AS finalAssignee,
          ${housekeepingPriorityExpr} AS priority,
          ${housekeepingNotesExpr} AS notes,
          ${housekeepingCleaningStartExpr} AS cleaningStart,
          ${housekeepingCleaningEndExpr} AS cleaningEnd,
          ${inventoryStatusExpr} AS hotelStatus,
          ${guestExpr} AS guest,
          ${checkInExpr} AS checkIn,
          ${checkOutExpr} AS checkOut
        FROM (
          ${baseRoomsSql}
        ) base
        LEFT JOIN (
          SELECT hk1.*
          FROM housekeeping hk1
          INNER JOIN (
            SELECT CAST(roomNo AS CHAR) AS roomNo, MAX(id) AS max_id
            FROM housekeeping
            GROUP BY CAST(roomNo AS CHAR)
          ) latest_hk
            ON latest_hk.max_id = hk1.id
        ) hk
          ON CAST(hk.roomNo AS CHAR) = base.roomNo
        ${assignmentJoin}
        ${inventoryJoin}
        ORDER BY CAST(base.roomNo AS UNSIGNED), base.roomNo
      `);

      const mapped = rows.map((room) => ({
        id: room.id,
        roomNo: room.roomNo,
        status: room.status || mapHotelStatusToHousekeeping(room.hotelStatus),
        assignee: room.finalAssignee || "No Housekeeper",
        priority: room.priority || "Normal",
        notes: room.notes || "",
        cleaningStart: room.cleaningStart || null,
        cleaningEnd: room.cleaningEnd || null,
        hotelStatus: room.hotelStatus || "available",
        guest: room.guest || "",
        checkIn: room.checkIn || null,
        checkOut: room.checkOut || null,
      }));

      callback(null, mapped);
    } catch (error) {
      callback(error);
    }
  },

  createRoom: async (data, callback) => {
    try {
      const roomNo = String(data.roomNo || "").trim();
      const status = data.status || "Vacant Dirty";
      const assignee = data.assignee || "No Housekeeper";
      const priority = data.priority || "Normal";
      const notes = data.notes || "";
      const cleaningStart = data.cleaningStart || null;
      const cleaningEnd = data.cleaningEnd || null;

      const existingRows = await runQuery(
        "SELECT id, status, assignee FROM housekeeping WHERE roomNo = ? LIMIT 1",
        [roomNo]
      );

      if (existingRows[0]) {
        await runQuery(
          `
          UPDATE housekeeping
          SET status = ?, assignee = ?, priority = ?, notes = ?, cleaningStart = ?, cleaningEnd = ?
          WHERE roomNo = ?
        `,
          [status, assignee, priority, notes, cleaningStart, cleaningEnd, roomNo]
        );

        await syncOperationalStatus(roomNo, status);

        await runQuery(
          `
          INSERT INTO housekeeping_logs
          (roomNo, oldStatus, newStatus, assignee, notes)
          VALUES (?, ?, ?, ?, ?)
        `,
          [
            roomNo,
            existingRows[0].status || null,
            status,
            assignee || existingRows[0].assignee || null,
            notes || null,
          ]
        );

        callback(null, {
          insertId: existingRows[0].id,
          updatedExisting: true,
        });
        return;
      }

      const sql = `
        INSERT INTO housekeeping
        (roomNo, status, assignee, priority, notes, cleaningStart, cleaningEnd)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await runQuery(sql, [
        roomNo,
        status,
        assignee,
        priority,
        notes,
        cleaningStart,
        cleaningEnd,
      ]);

      await syncOperationalStatus(roomNo, status);

      callback(null, {
        ...result,
        updatedExisting: false,
      });
    } catch (error) {
      callback(error);
    }
  },

  updateRoom: async (id, data, callback) => {
    try {
      const oldRows = await runQuery(
        "SELECT roomNo, status, assignee FROM housekeeping WHERE id = ? OR roomNo = ? LIMIT 1",
        [id, id]
      );

      const oldRoom = oldRows[0];

      await runQuery(
        `
        UPDATE housekeeping
        SET
          status = ?,
          assignee = ?,
          priority = ?,
          notes = ?,
          cleaningStart = ?,
          cleaningEnd = ?
        WHERE id = ? OR roomNo = ?
      `,
        [
          data.status,
          data.assignee,
          data.priority,
          data.notes,
          data.cleaningStart,
          data.cleaningEnd,
          id,
          id,
        ]
      );

      const roomNo = oldRoom?.roomNo || String(id);
      await syncOperationalStatus(roomNo, data.status);

      await runQuery(
        `
        INSERT INTO housekeeping_logs
        (roomNo, oldStatus, newStatus, assignee, notes)
        VALUES (?, ?, ?, ?, ?)
      `,
        [
          roomNo,
          oldRoom?.status || null,
          data.status,
          data.assignee || null,
          data.notes || null,
        ]
      );

      callback(null, { message: "Room updated" });
    } catch (error) {
      callback(error);
    }
  },

  updateStatus: async (id, status, callback) => {
    try {
      const oldRows = await runQuery(
        "SELECT roomNo, status, assignee FROM housekeeping WHERE id = ? OR roomNo = ? LIMIT 1",
        [id, id]
      );
      const oldRoom = oldRows[0];

      await runQuery(
        "UPDATE housekeeping SET status = ? WHERE id = ? OR roomNo = ?",
        [status, id, id]
      );

      await syncOperationalStatus(oldRoom?.roomNo || String(id), status);

      await runQuery(
        `
        INSERT INTO housekeeping_logs
        (roomNo, oldStatus, newStatus, assignee)
        VALUES (?, ?, ?, ?)
      `,
        [
          oldRoom?.roomNo || String(id),
          oldRoom?.status || null,
          status,
          oldRoom?.assignee || null,
        ]
      );

      callback(null, { message: "Status updated" });
    } catch (error) {
      callback(error);
    }
  },

  updateAssignee: async (id, assignee, callback) => {
    try {
      await runQuery(
        "UPDATE housekeeping SET assignee = ? WHERE id = ? OR roomNo = ?",
        [assignee, id, id]
      );

      callback(null, { message: "Assignee updated" });
    } catch (error) {
      callback(error);
    }
  },

  getLogs: async (callback) => {
    try {
      const rows = await runQuery(`
        SELECT *
        FROM housekeeping_logs
        ORDER BY changed_at DESC
      `);
      callback(null, rows);
    } catch (error) {
      callback(error);
    }
  },

  deleteRoom: async (id, callback) => {
    try {
      await runQuery("DELETE FROM housekeeping WHERE id = ?", [id]);
      callback(null, { message: "Room deleted" });
    } catch (error) {
      callback(error);
    }
  },
};

module.exports = Housekeeping;
