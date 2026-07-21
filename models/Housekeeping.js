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

const getColumnInfo = async (tableName, columnName) => {
  const rows = await runQuery(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
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
      type VARCHAR(50) NOT NULL DEFAULT 'Accommodation',
      roomNo VARCHAR(50) NOT NULL,
      building VARCHAR(50) NULL,
      floor VARCHAR(20) NULL,
      section VARCHAR(50) NULL,
      guestStatus VARCHAR(50) NULL,
      roomType VARCHAR(100) NULL,
      status VARCHAR(100) NOT NULL DEFAULT 'Vacant Dirty',
      assignee VARCHAR(100) NOT NULL DEFAULT 'No Housekeeper',
      layout VARCHAR(50) NULL,
      articles VARCHAR(50) NULL,
      services VARCHAR(50) NULL,
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

  const hasRoomNo = await columnExists("housekeeping", "roomNo");
  const hasLegacyRoomNumber = await columnExists("housekeeping", "room_number");

  // Migrate older schemas that used room_number instead of roomNo.
  if (!hasRoomNo && hasLegacyRoomNumber) {
    await runQuery(`
      ALTER TABLE housekeeping
      CHANGE COLUMN room_number roomNo VARCHAR(50) NOT NULL
    `);
  }

  const roomNoInfo = await getColumnInfo("housekeeping", "roomNo");
  if (roomNoInfo && !/^varchar\(50\)$/i.test(String(roomNoInfo.Type || ""))) {
    await runQuery("ALTER TABLE housekeeping MODIFY COLUMN roomNo VARCHAR(50) NOT NULL");
  }

  if (!(await columnExists("housekeeping", "type"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'Accommodation'");
  }

  if (!(await columnExists("housekeeping", "building"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN building VARCHAR(50) NULL");
  }

  if (!(await columnExists("housekeeping", "floor"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN floor VARCHAR(20) NULL");
  }

  if (!(await columnExists("housekeeping", "section"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN section VARCHAR(50) NULL");
  }

  if (!(await columnExists("housekeeping", "guestStatus"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN guestStatus VARCHAR(50) NULL");
  }

  if (!(await columnExists("housekeeping", "roomType"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN roomType VARCHAR(100) NULL");
  }

  if (!(await columnExists("housekeeping", "layout"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN layout VARCHAR(50) NULL");
  }

  if (!(await columnExists("housekeeping", "articles"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN articles VARCHAR(50) NULL");
  }

  if (!(await columnExists("housekeeping", "services"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN services VARCHAR(50) NULL");
  }

  if (!(await columnExists("housekeeping", "priority"))) {
    await runQuery(`
      ALTER TABLE housekeeping
      ADD COLUMN priority ENUM('Urgent','High','Normal','Low') NOT NULL DEFAULT 'Normal'
    `);
  }

  const notesInfo = await getColumnInfo("housekeeping", "notes");
  if (!notesInfo) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN notes TEXT NULL");
  } else if (/^tinyint/i.test(String(notesInfo.Type || ""))) {
    await runQuery("ALTER TABLE housekeeping MODIFY COLUMN notes TEXT NULL");
  }

  if (!(await columnExists("housekeeping", "cleaningStart"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN cleaningStart DATETIME NULL");
  }

  if (!(await columnExists("housekeeping", "cleaningEnd"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN cleaningEnd DATETIME NULL");
  }

  if (!(await columnExists("housekeeping", "updated_at"))) {
    await runQuery(`
      ALTER TABLE housekeeping
      ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    `);
  }

  // Pipeline + actor columns for Assigned -> In Progress -> Completed -> Verified flow.
  // All nullable / NULL-tolerant so legacy rows and old callers keep behaving as today.
  if (!(await columnExists("housekeeping", "assignee_user_id"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN assignee_user_id INT NULL");
  }

  if (!(await columnExists("housekeeping", "assigned_at"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN assigned_at DATETIME NULL");
  }

  if (!(await columnExists("housekeeping", "assigned_by_user_id"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN assigned_by_user_id INT NULL");
  }

  if (!(await columnExists("housekeeping", "started_at"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN started_at DATETIME NULL");
  }

  if (!(await columnExists("housekeeping", "completed_at"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN completed_at DATETIME NULL");
  }

  if (!(await columnExists("housekeeping", "verified_at"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN verified_at DATETIME NULL");
  }

  if (!(await columnExists("housekeeping", "verified_by_user_id"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN verified_by_user_id INT NULL");
  }

  if (!(await columnExists("housekeeping", "verified_by_name"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN verified_by_name VARCHAR(120) NULL");
  }

  if (!(await columnExists("housekeeping", "pipeline_status"))) {
    await runQuery("ALTER TABLE housekeeping ADD COLUMN pipeline_status VARCHAR(40) NULL");
  }

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

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hk_parameters (
      id INT NOT NULL AUTO_INCREMENT,
      cleaning_time_minutes INT NOT NULL DEFAULT 30,
      max_rooms_per_housekeeper INT NOT NULL DEFAULT 10,
      shift_start_time VARCHAR(10) NOT NULL DEFAULT '08:00',
      shift_end_time VARCHAR(10) NOT NULL DEFAULT '20:00',
      auto_release_enabled TINYINT(1) NOT NULL DEFAULT 1,
      inspection_required TINYINT(1) NOT NULL DEFAULT 1,
      default_assignee VARCHAR(100) NOT NULL DEFAULT 'No Housekeeper',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await runQuery("INSERT IGNORE INTO hk_parameters (id) VALUES (1)");

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hk_messages (
      id INT NOT NULL AUTO_INCREMENT,
      room_id VARCHAR(100) NULL,
      room_no VARCHAR(100) NULL,
      assigned_to VARCHAR(255) NULL,
      receptionist VARCHAR(255) NULL,
      message TEXT NOT NULL,
      task_label VARCHAR(255) NULL,
      due_at DATETIME NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'New',
      completed_at DATETIME NULL,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_hk_messages_assigned_to (assigned_to),
      INDEX idx_hk_messages_status (status),
      INDEX idx_hk_messages_sent_at (sent_at)
    )
  `);

  if (!(await columnExists("hk_messages", "assigned_to"))) {
    await runQuery("ALTER TABLE hk_messages ADD COLUMN assigned_to VARCHAR(255) NULL AFTER room_no");
  }
  if (!(await columnExists("hk_messages", "receptionist"))) {
    await runQuery("ALTER TABLE hk_messages ADD COLUMN receptionist VARCHAR(255) NULL AFTER assigned_to");
  }
  if (!(await columnExists("hk_messages", "task_label"))) {
    await runQuery("ALTER TABLE hk_messages ADD COLUMN task_label VARCHAR(255) NULL AFTER message");
  }
  if (!(await columnExists("hk_messages", "due_at"))) {
    await runQuery("ALTER TABLE hk_messages ADD COLUMN due_at DATETIME NULL AFTER task_label");
  }
  if (!(await columnExists("hk_messages", "status"))) {
    await runQuery("ALTER TABLE hk_messages ADD COLUMN status VARCHAR(60) NOT NULL DEFAULT 'New' AFTER due_at");
  }
  if (!(await columnExists("hk_messages", "completed_at"))) {
    await runQuery("ALTER TABLE hk_messages ADD COLUMN completed_at DATETIME NULL AFTER status");
  }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hk_amenities_consumption (
      id INT NOT NULL AUTO_INCREMENT,
      room_id VARCHAR(100) NULL,
      room_no VARCHAR(100) NULL,
      category VARCHAR(120) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      logged_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hk_inspections (
      id INT NOT NULL AUTO_INCREMENT,
      room_id VARCHAR(100) NULL,
      room_no VARCHAR(100) NULL,
      inspector_name VARCHAR(255) NOT NULL,
      priority VARCHAR(60) NOT NULL DEFAULT 'Normal',
      checklist_json LONGTEXT NULL,
      score INT NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hk_lost_found (
      id INT NOT NULL AUTO_INCREMENT,
      found_date DATE NOT NULL,
      found_room VARCHAR(100) NULL,
      room_id VARCHAR(100) NULL,
      found_by VARCHAR(255) NOT NULL,
      category VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      guest_name VARCHAR(255) NULL,
      storage_location VARCHAR(255) NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Found',
      notes TEXT NULL,
      claimed_by VARCHAR(255) NULL,
      claimed_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hk_shift_roster (
      id INT NOT NULL AUTO_INCREMENT,
      staff_name VARCHAR(255) NOT NULL,
      shift_date DATE NOT NULL,
      shift VARCHAR(120) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_hk_shift_roster_staff_date (staff_name, shift_date)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS hk_room_costing (
      id INT NOT NULL AUTO_INCREMENT,
      room_id VARCHAR(100) NULL,
      room_no VARCHAR(100) NULL,
      staff_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      linen_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      toiletrie_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      misc_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      logged_by VARCHAR(120) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
      const assignmentRoomColumn = hasAssignments
        ? (await columnExists("assignments", "room_number"))
          ? "room_number"
          : (await columnExists("assignments", "roomNumber"))
            ? "roomNumber"
            : null
        : null;
      const assignmentStaffColumn = hasAssignments
        ? (await columnExists("assignments", "staff_name"))
          ? "staff_name"
          : (await columnExists("assignments", "staffName"))
            ? "staffName"
            : (await columnExists("assignments", "assignee"))
              ? "assignee"
              : null
        : null;

      // sync rooms table -> housekeeping
      // Syncs the housekeeping.status from rooms.status ONLY when the row's
      // housekeeping.status is empty/NULL. Existing non-empty housekeeping.status
      // values are never overwritten here, so user changes (e.g. "Vacant Clean")
      // survive across refreshes and getAllRooms() calls.

      // Deduplicate any pre-existing duplicate roomNo rows (e.g. from a prior
      // migration when UNIQUE wasn't enforced) so dashboard status reads are
      // stable. Keep the most recent row (highest id) and prefer one whose
      // status is non-empty.
      try {
        await runQuery(`
          DELETE hk1 FROM housekeeping hk1
          INNER JOIN housekeeping hk2
            ON CAST(TRIM(hk1.roomNo) AS CHAR) COLLATE utf8mb4_general_ci = CAST(TRIM(hk2.roomNo) AS CHAR) COLLATE utf8mb4_general_ci
           AND (
             (hk1.id < hk2.id AND COALESCE(NULLIF(TRIM(hk1.status), ''), '') <> '')
             OR
             (hk1.id < hk2.id AND COALESCE(NULLIF(TRIM(hk2.status), ''), '') <> ''
              AND COALESCE(NULLIF(TRIM(hk1.status), ''), '') = '')
           )
        `);
      } catch (dedupeErr) {
        // best-effort cleanup; fall through if it can't run on this schema
      }

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
          ON CAST(hk.roomNo AS CHAR) COLLATE utf8mb4_general_ci = ${roomsRoomNoExpr} COLLATE utf8mb4_general_ci
        WHERE hk.id IS NULL
      `);

      // Also fix any legacy rows where housekeeping.status was empty/null —
      // those would otherwise fall back to the inventory status and the dashboard
      // would always show 'Occupied Dirty' / 'Vacant Dirty' regardless of what
      // the user picks. Use the rooms.status as the seed when missing.
      if (hasRooms) {
        await runQuery(`
          UPDATE housekeeping hk
          JOIN rooms r ON CAST(r.${roomNumberColumn} AS CHAR) COLLATE utf8mb4_general_ci = CAST(hk.roomNo AS CHAR) COLLATE utf8mb4_general_ci
          SET hk.status = CASE
              WHEN LOWER(${roomStatusExpr}) = 'occupied' THEN 'Occupied Dirty'
              WHEN LOWER(${roomStatusExpr}) = 'cleaning' THEN 'Cleaning In Progress'
              WHEN LOWER(${roomStatusExpr}) = 'out of service' THEN 'Out of Service'
              ELSE 'Vacant Clean'
            END
          WHERE hk.status IS NULL OR TRIM(hk.status) = ''
        `);
      }

      let assignmentJoin = "";
      let assignmentAssigneeExpr = "NULL";
      if (assignmentRoomColumn && assignmentStaffColumn) {
        assignmentJoin = `
          LEFT JOIN (
            SELECT
              CAST(a1.${assignmentRoomColumn} AS CHAR) COLLATE utf8mb4_general_ci AS room_number,
              a1.${assignmentStaffColumn} AS staff_name
            FROM assignments a1
            INNER JOIN (
              SELECT ${assignmentRoomColumn} AS room_number, MAX(id) AS max_id
              FROM assignments
              GROUP BY ${assignmentRoomColumn}
            ) latest
              ON CAST(latest.room_number AS CHAR) COLLATE utf8mb4_general_ci = CAST(a1.${assignmentRoomColumn} AS CHAR) COLLATE utf8mb4_general_ci
             AND latest.max_id = a1.id
          ) a ON CAST(a.room_number AS CHAR) COLLATE utf8mb4_general_ci = CAST(base.room_number AS CHAR) COLLATE utf8mb4_general_ci
        `;
        assignmentAssigneeExpr = "NULLIF(a.staff_name, '')";
      }

      let inventoryJoin = "";
      let hotelStatusExpr = `base.room_status`;
      let guestExpr = "NULL";
      let checkInExpr = "NULL";
      let checkOutExpr = "NULL";

      if (hasInventory) {
        inventoryJoin = `
          LEFT JOIN hotel_room_inventory hri
            ON CAST(hri.room_number AS CHAR) COLLATE utf8mb4_general_ci = CAST(base.room_number AS CHAR) COLLATE utf8mb4_general_ci
        `;
        hotelStatusExpr = `COALESCE(NULLIF(hri.status, ''), base.room_status)`;
        guestExpr = "hri.guest";
        checkInExpr = "hri.check_in";
        checkOutExpr = "hri.check_out";
      }

      // Authoritative logic: housekeeping.status is the source of truth when set.
      // Only fall back to the inventory/rooms hotelStatus when housekeeping has
      // no entry yet (shouldn't normally happen because we INSERT-missing above).
      // We UNION ALL 'rooms', 'hotel_room_inventory', AND 'housekeeping' so that
      // rooms created ONLY through the housekeeping UI (no row in rooms or
      // inventory) still appear on the dashboard.
      let baseRoomListSql;
      if (hasInventory) {
        baseRoomListSql = `
          SELECT room_number, room_status FROM (
            SELECT
              CAST(r.${roomNumberColumn} AS CHAR) COLLATE utf8mb4_general_ci AS room_number,
              CAST(${roomStatusExpr} AS CHAR) COLLATE utf8mb4_general_ci AS room_status
            FROM rooms r
            UNION ALL
            SELECT
              CAST(hri.room_number AS CHAR) COLLATE utf8mb4_general_ci AS room_number,
              CAST(COALESCE(NULLIF(hri.status, ''), 'available') AS CHAR) COLLATE utf8mb4_general_ci AS room_status
            FROM hotel_room_inventory hri
            LEFT JOIN rooms rr
              ON CAST(rr.${roomNumberColumn} AS CHAR) COLLATE utf8mb4_general_ci = CAST(hri.room_number AS CHAR) COLLATE utf8mb4_general_ci
            WHERE rr.${roomNumberColumn} IS NULL
            UNION ALL
            SELECT
              CAST(hk.roomNo AS CHAR) COLLATE utf8mb4_general_ci AS room_number,
              CAST(COALESCE(NULLIF(hk.status, ''), 'available') AS CHAR) COLLATE utf8mb4_general_ci AS room_status
            FROM housekeeping hk
          ) AS all_rooms
          GROUP BY room_number
        `;
      } else {
        baseRoomListSql = `
          SELECT room_number, room_status FROM (
            SELECT
              CAST(r.${roomNumberColumn} AS CHAR) COLLATE utf8mb4_general_ci AS room_number,
              CAST(${roomStatusExpr} AS CHAR) COLLATE utf8mb4_general_ci AS room_status
            FROM rooms r
            UNION ALL
            SELECT
              CAST(hk.roomNo AS CHAR) COLLATE utf8mb4_general_ci AS room_number,
              CAST(COALESCE(NULLIF(hk.status, ''), 'available') AS CHAR) COLLATE utf8mb4_general_ci AS room_status
            FROM housekeeping hk
          ) AS all_rooms
          GROUP BY room_number
        `;
      }

      // roomIdSelectId is the housekeeping.id (preferred) so frontend PUTs hit
      // the right row. If no housekeeping row exists yet, fall back to the
      // synthetic numeric hash of the room number to still produce a usable id.
      const rows = await runQuery(`
        SELECT
          hk.id AS id,
          base.room_number AS roomNo,
          COALESCE(NULLIF(hk.type, ''), 'Accommodation') AS type,
          NULLIF(hk.building, '') AS building,
          NULLIF(hk.floor, '') AS floor,
          NULLIF(hk.section, '') AS section,
          NULLIF(hk.guestStatus, '') AS guestStatus,
          NULLIF(hk.roomType, '') AS roomType,
          COALESCE(
            NULLIF(hk.status, ''),
            CASE
              WHEN LOWER(base.room_status) = 'occupied' THEN 'Occupied Dirty'
              WHEN LOWER(base.room_status) = 'cleaning' THEN 'Cleaning In Progress'
              WHEN LOWER(base.room_status) = 'out of service' THEN 'Out of Service'
              ELSE 'Vacant Clean'
            END
          ) AS status,
          COALESCE(NULLIF(hk.assignee, ''), ${assignmentAssigneeExpr}, 'No Housekeeper') AS finalAssignee,
          ${housekeepingPriorityExpr} AS priority,
          ${housekeepingNotesExpr} AS notes,
          ${housekeepingCleaningStartExpr} AS cleaningStart,
          ${housekeepingCleaningEndExpr} AS cleaningEnd,
          NULLIF(hk.layout, '') AS layout,
          NULLIF(hk.articles, '') AS articles,
          NULLIF(hk.services, '') AS services,
          base.room_status AS hotelStatus,
          ${guestExpr} AS guest,
          ${checkInExpr} AS checkIn,
          ${checkOutExpr} AS checkOut,
          hk.assignee_user_id AS assigneeUserId,
          hk.assigned_at AS assignedAt,
          hk.assigned_by_user_id AS assignedByUserId,
          hk.started_at AS startedAt,
          hk.completed_at AS completedAt,
          hk.verified_at AS verifiedAt,
          hk.verified_by_user_id AS verifiedByUserId,
          hk.verified_by_name AS verifiedByName,
          NULLIF(hk.pipeline_status, '') AS pipelineStatus
        FROM (
          ${baseRoomListSql}
        ) base
        LEFT JOIN housekeeping hk
          ON CAST(hk.roomNo AS CHAR) COLLATE utf8mb4_general_ci = CAST(base.room_number AS CHAR) COLLATE utf8mb4_general_ci
        ${assignmentJoin}
        ${inventoryJoin}
        ORDER BY base.room_number + 0, base.room_number
      `);

      const mapped = rows.map((room) => ({
        id: room.id,
        roomNo: room.roomNo,
        type: room.type || "Accommodation",
        building: room.building || "",
        floor: room.floor || "",
        section: room.section || "",
        guestStatus: room.guestStatus || "",
        roomType: room.roomType || "",
        status: room.status || mapHotelStatusToHousekeeping(room.hotelStatus),
        assignee: room.finalAssignee || "No Housekeeper",
        priority: room.priority || "Normal",
        notes: room.notes || "",
        cleaningStart: room.cleaningStart || null,
        cleaningEnd: room.cleaningEnd || null,
        layout: room.layout || "",
        articles: room.articles || "",
        services: room.services || "",
        hotelStatus: room.hotelStatus || "available",
        guest: room.guest || "",
        checkIn: room.checkIn || null,
        checkOut: room.checkOut || null,
        // pipeline fields (Assigned -> In Progress -> Completed -> Verified)
        assigneeUserId: room.assigneeUserId || null,
        assignedAt: room.assignedAt || null,
        assignedByUserId: room.assignedByUserId || null,
        startedAt: room.startedAt || null,
        completedAt: room.completedAt || null,
        verifiedAt: room.verifiedAt || null,
        verifiedByUserId: room.verifiedByUserId || null,
        verifiedByName: room.verifiedByName || "",
        pipelineStatus: room.pipelineStatus || null,
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
      const type = data.type || "Accommodation";
      const building = data.building || null;
      const floor = data.floor || null;
      const section = data.section || null;
      const guestStatus = data.guestStatus || null;
      const roomType = data.roomType || null;
      const priority = data.priority || "Normal";
      const notes = data.notes || "";
      const cleaningStart = data.cleaningStart || null;
      const cleaningEnd = data.cleaningEnd || null;
      const layout = data.layout || null;
      const articles = data.articles || null;
      const services = data.services || null;

      const existingRows = await runQuery(
        "SELECT id, status, assignee FROM housekeeping WHERE roomNo = ? LIMIT 1",
        [roomNo]
      );

      if (existingRows[0]) {
        await runQuery(
          `
          UPDATE housekeeping
          SET type = ?, building = ?, floor = ?, section = ?, guestStatus = ?, roomType = ?,
              status = ?, assignee = ?, priority = ?, notes = ?, cleaningStart = ?, cleaningEnd = ?,
              layout = ?, articles = ?, services = ?,
              assignee_user_id = NULL, assigned_at = NULL, assigned_by_user_id = NULL,
              started_at = NULL, completed_at = NULL,
              verified_at = NULL, verified_by_user_id = NULL, verified_by_name = NULL,
              pipeline_status = NULL
          WHERE roomNo = ?
        `,
          [
            type,
            building,
            floor,
            section,
            guestStatus,
            roomType,
            status,
            assignee,
            priority,
            notes,
            cleaningStart,
            cleaningEnd,
            layout,
            articles,
            services,
            roomNo,
          ]
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
        (type, roomNo, building, floor, section, guestStatus, roomType, status, assignee, priority, notes, cleaningStart, cleaningEnd, layout, articles, services)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await runQuery(sql, [
        type,
        roomNo,
        building,
        floor,
        section,
        guestStatus,
        roomType,
        status,
        assignee,
        priority,
        notes,
        cleaningStart,
        cleaningEnd,
        layout,
        articles,
        services,
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
          type = ?,
          building = ?,
          floor = ?,
          section = ?,
          guestStatus = ?,
          roomType = ?,
          status = ?,
          assignee = ?,
          priority = ?,
          notes = ?,
          cleaningStart = ?,
          cleaningEnd = ?,
          layout = ?,
          articles = ?,
          services = ?
        WHERE id = ? OR roomNo = ?
      `,
        [
          data.type || "Accommodation",
          data.building || null,
          data.floor || null,
          data.section || null,
          data.guestStatus || null,
          data.roomType || null,
          data.status,
          data.assignee,
          data.priority,
          data.notes,
          data.cleaningStart,
          data.cleaningEnd,
          data.layout || null,
          data.articles || null,
          data.services || null,
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
      // Resolve the housekeeping row by id OR by trimmed roomNo, but if id is
      // a non-numeric string (e.g. user passed a room number), prefer the
      // explicit roomNo match to avoid type-coerce surprises on the INT column.
      const numericId = /^\d+$/.test(String(id)) ? Number(id) : null;
      let oldRows = [];
      if (numericId !== null) {
        oldRows = await runQuery(
          "SELECT id, roomNo, status, assignee FROM housekeeping WHERE id = ? OR CAST(roomNo AS CHAR) = CAST(? AS CHAR) LIMIT 1",
          [numericId, String(id)]
        );
      } else {
        oldRows = await runQuery(
          "SELECT id, roomNo, status, assignee FROM housekeeping WHERE CAST(roomNo AS CHAR) = CAST(? AS CHAR) LIMIT 1",
          [String(id)]
        );
      }
      const oldRoom = oldRows[0];
      const targetRoomNo = oldRoom?.roomNo || String(id);

      await runQuery(
        `UPDATE housekeeping
         SET status = ?
         WHERE CAST(roomNo AS CHAR) = CAST(? AS CHAR)`,
        [status, targetRoomNo]
      );

      await syncOperationalStatus(targetRoomNo, status);

      await runQuery(
        `
        INSERT INTO housekeeping_logs
        (roomNo, oldStatus, newStatus, assignee)
        VALUES (?, ?, ?, ?)
      `,
        [
          targetRoomNo,
          oldRoom?.status || null,
          status,
          oldRoom?.assignee || null,
        ]
      );

      callback(null, { message: "Status updated", roomNo: targetRoomNo });
    } catch (error) {
      callback(error);
    }
  },

  // Now accepts optional userId (assignee_user_id) and assignedByUserId so the
  // pipeline (claim/assign step) can track who is assigned and who assigned them.
  // Backward-compatible: existing callers passing only (id, assignee, callback)
  // keep working unchanged because updateAssignee(id, assignee, callback) is
  // still a valid call shape (options defaults to {}).
  updateAssignee: async (id, assignee, options, callback) => {
    // Support legacy signature: updateAssignee(id, assignee, callback)
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    options = options || {};

    try {
      const userId = options.userId ?? null;
      const assignedByUserId = options.assignedByUserId ?? null;

      await runQuery(
        `
        UPDATE housekeeping
        SET assignee = ?,
            assignee_user_id = ?,
            assigned_at = NOW(),
            assigned_by_user_id = ?,
            pipeline_status = 'Assigned'
        WHERE id = ? OR roomNo = ?
      `,
        [assignee, userId, assignedByUserId, id, id]
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
      await runQuery("DELETE FROM housekeeping WHERE id = ? OR CAST(roomNo AS CHAR) = CAST(? AS CHAR)", [id, id]);
      callback(null, { message: "Room deleted" });
    } catch (error) {
      callback(error);
    }
  },
};

module.exports = Housekeeping;
