const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const tableExists = async (tableName) => {
  const rows = await runQuery("SHOW TABLES LIKE ?", [tableName]);
  return Array.isArray(rows) && rows.length > 0;
};

const mapHotelStatusToHousekeeping = (status) => {
  const s = String(status || "").toLowerCase();
  if (s === "occupied") return "Occupied Dirty";
  if (s === "available") return "Vacant Dirty";
  if (s === "cleaning") return "Vacant Dirty";
  return "Vacant Dirty";
};

const Housekeeping = {

    getAllRooms: async (callback) => {
        try {
            const hasRooms = await tableExists("rooms");
            const hasHousekeeping = await tableExists("housekeeping");
            const hasAssignments = await tableExists("assignments");

            if (!hasRooms) {
                return callback(null, []);
            }

            if (hasHousekeeping) {
                await runQuery(`
                  INSERT INTO housekeeping (roomNo, status, assignee)
                  SELECT 
                    CAST(r.room_number AS CHAR),
                    CASE
                      WHEN LOWER(r.status) = 'occupied' THEN 'Occupied Dirty'
                      ELSE 'Vacant Dirty'
                    END,
                    'No Housekeeper'
                  FROM rooms r
                  LEFT JOIN housekeeping hk ON CAST(hk.roomNo AS CHAR) = CAST(r.room_number AS CHAR)
                  WHERE hk.id IS NULL
                `);
            }

            let assignmentJoin = "";
            if (hasAssignments) {
                assignmentJoin = `
                  LEFT JOIN (
                    SELECT a1.room_number, a1.staff_name
                    FROM assignments a1
                    INNER JOIN (
                      SELECT room_number, MAX(id) AS max_id
                      FROM assignments
                      WHERE status = 'Pending'
                      GROUP BY room_number
                    ) latest
                      ON latest.room_number = a1.room_number AND latest.max_id = a1.id
                  ) a ON CAST(a.room_number AS CHAR) = CAST(r.room_number AS CHAR)
                `;
            }

            const housekeepingJoin = hasHousekeeping
              ? "LEFT JOIN housekeeping hk ON CAST(hk.roomNo AS CHAR) = CAST(r.room_number AS CHAR)"
              : "";
            const housekeepingIdSelect = hasHousekeeping ? "COALESCE(hk.id, 0)" : "0";
            const housekeepingStatusSelect = hasHousekeeping
              ? `COALESCE(NULLIF(hk.status, ''), CASE
                  WHEN LOWER(r.status) = 'occupied' THEN 'Occupied Dirty'
                  ELSE 'Vacant Dirty'
                END)`
              : `CASE
                  WHEN LOWER(r.status) = 'occupied' THEN 'Occupied Dirty'
                  ELSE 'Vacant Dirty'
                END`;
            const housekeepingAssigneeSelect = hasHousekeeping
              ? "NULLIF(hk.assignee, '')"
              : "NULL";

            const rows = await runQuery(`
              SELECT
                ${housekeepingIdSelect} AS housekeepingId,
                CAST(r.room_number AS CHAR) AS roomNo,
                r.status AS hotelStatus,
                r.guest,
                DATE(r.check_in) AS checkIn,
                DATE(r.check_out) AS checkOut,
                ${housekeepingStatusSelect} AS status,
                COALESCE(NULLIF(${hasAssignments ? "a.staff_name" : "NULL"}, ''), ${housekeepingAssigneeSelect}, 'No Housekeeper') AS assignee
              FROM rooms r
              ${housekeepingJoin}
              ${assignmentJoin}
              ORDER BY CAST(r.room_number AS UNSIGNED), r.room_number
            `);

            const mapped = rows.map((r) => ({
                id: r.housekeepingId || r.roomNo,
                roomNo: r.roomNo,
                status: r.status || mapHotelStatusToHousekeeping(r.hotelStatus),
                assignee: r.assignee || "No Housekeeper",
                hotelStatus: r.hotelStatus || "Available",
                guest: r.guest || null,
                checkIn: r.checkIn || null,
                checkOut: r.checkOut || null,
            }));

            callback(null, mapped);
        } catch (err) {
            callback(err);
        }
    },

    createRoom: (data, callback) => {

        const sql = `
      INSERT INTO housekeeping (roomNo, status, assignee)
      VALUES (?, ?, ?)
    `;

        db.query(sql, [data.roomNo, data.status, data.assignee], callback);

    },

    updateStatus: (id, status, callback) => {
        const sql = "UPDATE housekeeping SET status=? WHERE id=? OR CAST(roomNo AS CHAR)=CAST(? AS CHAR)";
        db.query(sql, [status, id, id], callback);
    },

    updateAssignee: (id, assignee, callback) => {
        const sql = "UPDATE housekeeping SET assignee=? WHERE id=? OR CAST(roomNo AS CHAR)=CAST(? AS CHAR)";
        db.query(sql, [assignee, id, id], callback);
    },

    deleteRoom: (id, callback) => {
        const sql = "DELETE FROM housekeeping WHERE id=?";
        db.query(sql, [id], callback);
    }

};

module.exports = Housekeeping;
