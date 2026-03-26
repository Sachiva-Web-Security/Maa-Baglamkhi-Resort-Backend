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

      if (!hasRooms) {
        return callback(null, []);
      }

      // sync rooms table -> housekeeping
      await runQuery(`
        INSERT INTO housekeeping (roomNo, status, assignee)
        SELECT
          CAST(r.room_number AS CHAR),
          CASE
            WHEN LOWER(COALESCE(r.status, 'available')) = 'occupied' THEN 'Occupied Dirty'
            WHEN LOWER(COALESCE(r.status, 'available')) = 'cleaning' THEN 'Cleaning In Progress'
            WHEN LOWER(COALESCE(r.status, 'available')) = 'out of service' THEN 'Out of Service'
            ELSE 'Vacant Clean'
          END,
          'No Housekeeper'
        FROM rooms r
        LEFT JOIN housekeeping hk
          ON CAST(hk.roomNo AS CHAR) = CAST(r.room_number AS CHAR)
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
          ) a ON CAST(a.room_number AS CHAR) = CAST(r.room_number AS CHAR)
        `;
      }

      const rows = await runQuery(`
        SELECT
          hk.id,
          hk.roomNo,
          hk.status,
          hk.assignee,
          hk.priority,
          hk.notes,
          hk.cleaningStart,
          hk.cleaningEnd,
          r.status AS hotelStatus,
          r.guest,
          DATE(r.check_in) AS checkIn,
          DATE(r.check_out) AS checkOut,
          COALESCE(NULLIF(${hasAssignments ? "a.staff_name" : "NULL"}, ''), NULLIF(hk.assignee, ''), 'No Housekeeper') AS finalAssignee
        FROM rooms r
        LEFT JOIN housekeeping hk
          ON CAST(hk.roomNo AS CHAR) = CAST(r.room_number AS CHAR)
        ${assignmentJoin}
        ORDER BY CAST(r.room_number AS UNSIGNED), r.room_number
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
