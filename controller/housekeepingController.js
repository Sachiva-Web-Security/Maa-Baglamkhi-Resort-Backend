const db = require("../config/db");
const Housekeeping = require("../models/Housekeeping");
const {
  ensureSchema: ensureCompletedCleaningLogSchema,
} = require("../models/CompletedCleaningLogModel");

exports.getAllRooms = (req, res) => {
  Housekeeping.getAllRooms((err, results) => {
    if (err) {
      console.error("getAllRooms error:", err);
      return res.status(500).json({
        message: "Database error",
        error: err.message,
      });
    }

    res.json(results);
  });
};

exports.createRoom = (req, res) => {
  const data = {
    roomNo: req.body.roomNo || req.body.roomNumber,
    status: req.body.status,
    assignee: req.body.assignee,
    priority: req.body.priority,
    notes: req.body.notes,
    cleaningStart: req.body.cleaningStart,
    cleaningEnd: req.body.cleaningEnd,
  };

  if (!data.roomNo) {
    return res.status(400).json({ message: "roomNo is required" });
  }

  Housekeeping.createRoom(data, (err, result) => {
    if (err) {
      console.error("createRoom error:", err);
      return res.status(500).json({
        message: "Insert failed",
        error: err.message,
      });
    }

    res.json({
      message: result.updatedExisting
        ? "Room already existed, details updated successfully"
        : "Room created successfully",
      id: result.insertId,
      updatedExisting: Boolean(result.updatedExisting),
    });
  });
};

exports.updateRoom = (req, res) => {
  const id = req.params.id;

  const data = {
    status: req.body.status || "Vacant Dirty",
    assignee: req.body.assignee || "No Housekeeper",
    priority: req.body.priority || "Normal",
    notes: req.body.notes || "",
    cleaningStart: req.body.cleaningStart || null,
    cleaningEnd: req.body.cleaningEnd || null,
  };

  Housekeeping.updateRoom(id, data, (err, result) => {
    if (err) {
      console.error("updateRoom error:", err);
      return res.status(500).json({
        message: "Update failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};

exports.updateStatus = (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: "status is required" });
  }

  Housekeeping.updateStatus(id, status, (err, result) => {
    if (err) {
      console.error("updateStatus error:", err);
      return res.status(500).json({
        message: "Status update failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};

exports.updateAssignee = (req, res) => {
  const id = req.params.id;
  const { assignee } = req.body;

  if (!assignee) {
    return res.status(400).json({ message: "assignee is required" });
  }

  Housekeeping.updateAssignee(id, assignee, (err, result) => {
    if (err) {
      console.error("updateAssignee error:", err);
      return res.status(500).json({
        message: "Assignee update failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};

exports.getLogs = (req, res) => {
  Housekeeping.getLogs((err, results) => {
    if (err) {
      console.error("getLogs error:", err);
      return res.status(500).json({
        message: "Logs fetch failed",
        error: err.message,
      });
    }

    res.json(results);
  });
};

exports.deleteRoom = (req, res) => {
  const id = req.params.id;

  Housekeeping.deleteRoom(id, (err, result) => {
    if (err) {
      console.error("deleteRoom error:", err);
      return res.status(500).json({
        message: "Delete failed",
        error: err.message,
      });
    }

    res.json(result);
  });
};
// =============================================
// HELPERS
// =============================================
const query = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

// =============================================
// EXISTING — GET ALL ROOMS
// =============================================
exports.getAllRooms = async (req, res) => {
  try {
    Housekeeping.getAllRooms((err, results) => {
      if (err) {
        return res.status(500).json({ message: "Database error", error: err });
      }
      return res.json(results);
    });
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err });
  }
};

// =============================================
// EXISTING — CREATE ROOM
// =============================================
exports.createRoom = async (req, res) => {
  const { roomNumber, status, assignee } = req.body;
  try {
    const result = await query(
      "INSERT INTO housekeeping (roomNo, status, assignee) VALUES (?, ?, ?)",
      [roomNumber, status || "Vacant Dirty", assignee || "No Housekeeper"]
    );
    res.json({ message: "Room created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

// =============================================
// EXISTING — UPDATE STATUS
// =============================================
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await query("UPDATE housekeeping SET status = ? WHERE id = ? OR CAST(roomNo AS CHAR) = CAST(? AS CHAR)", [status, id, id]);
    res.json({ message: "Status updated" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err });
  }
};

// =============================================
// EXISTING — UPDATE ASSIGNEE
// =============================================
exports.updateAssignee = async (req, res) => {
  const { id } = req.params;
  const { assignee } = req.body;
  try {
    await query("UPDATE housekeeping SET assignee = ? WHERE id = ? OR CAST(roomNo AS CHAR) = CAST(? AS CHAR)", [assignee, id, id]);
    res.json({ message: "Assignee updated" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err });
  }
};

// =============================================
// EXISTING — DELETE ROOM
// =============================================
exports.deleteRoom = async (req, res) => {
  const { id } = req.params;
  try {
    await query("DELETE FROM housekeeping WHERE id = ?", [id]);
    res.json({ message: "Room deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err });
  }
};

// =============================================
// PARAMETERS
// =============================================
exports.getParameters = async (req, res) => {
  try {
    const rows = await query("SELECT * FROM hk_parameters LIMIT 1");
    res.json(rows[0] || {
      cleaning_time_minutes: 30,
      max_rooms_per_housekeeper: 10,
      shift_start_time: "08:00",
      shift_end_time: "20:00",
      auto_release_enabled: true,
      inspection_required: true,
    });
  } catch {
    res.json({});
  }
};

exports.saveParameters = async (req, res) => {
  const {
    cleaningTimeMinutes, maxRoomsPerHousekeeper, shiftStartTime, shiftEndTime,
    autoReleaseEnabled, inspectionRequired, defaultAssignee,
  } = req.body;
  try {
    const existing = await query("SELECT id FROM hk_parameters LIMIT 1");
    if (existing.length > 0) {
      await query(
        `UPDATE hk_parameters SET
          cleaning_time_minutes = ?, max_rooms_per_housekeeper = ?,
          shift_start_time = ?, shift_end_time = ?,
          auto_release_enabled = ?, inspection_required = ?, default_assignee = ?
          WHERE id = ?`,
        [cleaningTimeMinutes, maxRoomsPerHousekeeper, shiftStartTime, shiftEndTime,
         autoReleaseEnabled ? 1 : 0, inspectionRequired ? 1 : 0, defaultAssignee || "No Housekeeper", existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO hk_parameters
          (cleaning_time_minutes, max_rooms_per_housekeeper, shift_start_time, shift_end_time, auto_release_enabled, inspection_required, default_assignee)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [cleaningTimeMinutes, maxRoomsPerHousekeeper, shiftStartTime, shiftEndTime,
         autoReleaseEnabled ? 1 : 0, inspectionRequired ? 1 : 0, defaultAssignee || "No Housekeeper"]
      );
    }
    res.json({ message: "Parameters saved" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save parameters", error: err });
  }
};

// =============================================
// MESSAGE TO RECEPTION
// =============================================
exports.sendMessage = async (req, res) => {
  const { roomId, roomNo, message } = req.body;
  try {
    await query(
      "INSERT INTO hk_messages (room_id, room_no, message, sent_at) VALUES (?, ?, ?, NOW())",
      [roomId, roomNo, message]
    );
    res.json({ message: "Message sent" });
  } catch (err) {
    res.status(500).json({ message: "Failed to send message", error: err });
  }
};

// =============================================
// AMENITIES CONSUMPTION
// =============================================
exports.getAmenities = async (req, res) => {
  const { roomId, date } = req.query;
  let sql = "SELECT * FROM hk_amenities_consumption WHERE 1=1";
  const params = [];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  if (date)   { sql += " AND DATE(created_at) = ?"; params.push(date); }
  sql += " ORDER BY created_at DESC";
  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err });
  }
};

exports.logAmenity = async (req, res) => {
  const { roomId, roomNo, category, itemName, quantity, unitCost, notes, loggedBy } = req.body;
  const totalCost = (parseFloat(unitCost) || 0) * (parseInt(quantity) || 1);
  try {
    const result = await query(
      `INSERT INTO hk_amenities_consumption
        (room_id, room_no, category, item_name, quantity, unit_cost, total_cost, notes, logged_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [roomId, roomNo, category, itemName, quantity, unitCost || 0, totalCost, notes || null, loggedBy || "Staff"]
    );
    res.json({ message: "Amenity logged", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

exports.deleteAmenity = async (req, res) => {
  try {
    await query("DELETE FROM hk_amenities_consumption WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err });
  }
};

// =============================================
// INSPECTION CHECKLIST
// =============================================
exports.getInspections = async (req, res) => {
  const { roomId } = req.query;
  let sql = "SELECT * FROM hk_inspections WHERE 1=1";
  const params = [];
  if (roomId) { sql += " AND room_id = ?"; params.push(roomId); }
  sql += " ORDER BY created_at DESC LIMIT 100";
  try {
    const results = await query(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err });
  }
};

exports.createInspection = async (req, res) => {
  const { roomId, roomNo, inspectorName, priority, checklist, score, notes } = req.body;
  try {
    const result = await query(
      `INSERT INTO hk_inspections
        (room_id, room_no, inspector_name, priority, checklist_json, score, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [roomId, roomNo, inspectorName, priority || "Normal", JSON.stringify(checklist || {}), score || 0, notes || null]
    );
    // If score >= 90, auto-update room status to Vacant Clean Inspected
    if (score >= 90) {
      await query("UPDATE housekeeping SET status = 'Vacant Clean Inspected' WHERE id = ?", [roomId]);
    }
    res.json({ message: "Inspection submitted", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

exports.getInspectionById = async (req, res) => {
  try {
    const rows = await query("SELECT * FROM hk_inspections WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    const row = rows[0];
    try { row.checklist_json = JSON.parse(row.checklist_json); } catch { /* leave as string */ }
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err });
  }
};

// =============================================
// LOST & FOUND
// =============================================
exports.getLostFound = async (req, res) => {
  try {
    const results = await query("SELECT * FROM hk_lost_found ORDER BY created_at DESC");
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err });
  }
};

exports.createLostFound = async (req, res) => {
  const { foundDate, roomNo, roomId, foundBy, category, description, guestName, storageLocation, status, notes } = req.body;
  try {
    const result = await query(
      `INSERT INTO hk_lost_found
        (found_date, found_room, room_id, found_by, category, description, guest_name, storage_location, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [foundDate || new Date().toISOString().slice(0, 10), roomNo, roomId || null, foundBy, category, description, guestName || null, storageLocation || null, status || "Found", notes || null]
    );
    res.json({ message: "Item reported", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

exports.updateLostFound = async (req, res) => {
  const { id } = req.params;
  const { status, claimedBy, claimedDate } = req.body;
  try {
    await query(
      "UPDATE hk_lost_found SET status = ?, claimed_by = ?, claimed_date = ? WHERE id = ?",
      [status, claimedBy || null, claimedDate || null, id]
    );
    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err });
  }
};

exports.deleteLostFound = async (req, res) => {
  try {
    await query("DELETE FROM hk_lost_found WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err });
  }
};

// =============================================
// SHIFT / DUTY ROSTER
// =============================================
exports.getRoster = async (req, res) => {
  const { weekStart } = req.query;
  try {
    let sql = "SELECT * FROM hk_shift_roster WHERE 1=1";
    const params = [];
    if (weekStart) {
      sql += " AND shift_date >= ? AND shift_date <= DATE_ADD(?, INTERVAL 6 DAY)";
      params.push(weekStart, weekStart);
    }
    sql += " ORDER BY staff_name, shift_date";
    const results = await query(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err });
  }
};

exports.saveRoster = async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ message: "No entries provided" });
  }
  try {
    for (const entry of entries) {
      const existing = await query(
        "SELECT id FROM hk_shift_roster WHERE staff_name = ? AND shift_date = ?",
        [entry.staffName, entry.shiftDate]
      );
      if (existing.length > 0) {
        await query("UPDATE hk_shift_roster SET shift = ? WHERE id = ?", [entry.shift, existing[0].id]);
      } else {
        await query(
          "INSERT INTO hk_shift_roster (staff_name, shift_date, shift) VALUES (?, ?, ?)",
          [entry.staffName, entry.shiftDate, entry.shift]
        );
      }
    }
    res.json({ message: "Roster saved", count: entries.length });
  } catch (err) {
    res.status(500).json({ message: "Failed to save roster", error: err });
  }
};

// =============================================
// ROOM COSTING
// =============================================
exports.getCostingLogs = async (req, res) => {
  try {
    const results = await query("SELECT * FROM hk_room_costing ORDER BY created_at DESC");
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Database error", error: err });
  }
};

exports.logCost = async (req, res) => {
  const {
    roomId, roomNo,
    staffCostPerHour, avgCleaningHours, lineCostPerClean, toiletrieCostPerClean, miscCostPerClean,
    totalCost, loggedBy,
  } = req.body;
  const staffCost = (parseFloat(staffCostPerHour) || 0) * (parseFloat(avgCleaningHours) || 0);
  try {
    const result = await query(
      `INSERT INTO hk_room_costing
        (room_id, room_no, staff_cost, linen_cost, toiletrie_cost, misc_cost, total_cost, logged_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [roomId, roomNo, staffCost, lineCostPerClean || 0, toiletrieCostPerClean || 0, miscCostPerClean || 0, totalCost, loggedBy || "Staff"]
    );
    res.json({ message: "Cost logged", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Insert failed", error: err });
  }
};

// =============================================
// CHECKOUT REPORT
// =============================================
exports.getCheckoutReport = async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().slice(0, 10);
  try {
    // Join bookings with rooms and housekeeping to get checkout rooms needing cleaning
    const results = await query(
      `SELECT
        b.id AS booking_id,
        b.checkout_date,
        b.check_out AS checkout_time,
        g.name AS guest_name,
        r.room_number AS room_no,
        r.id AS room_id,
        h.id AS hk_room_id,
        h.status AS hk_status,
        h.assignee
      FROM bookings b
      LEFT JOIN guests g ON g.id = b.guest_id
      LEFT JOIN rooms r ON r.id = b.room_id
      LEFT JOIN housekeeping h ON h.roomNo = r.room_number
      WHERE DATE(b.checkout_date) = ?
        AND b.status = 'Checked Out'
      ORDER BY b.check_out DESC`,
      [targetDate]
    );
    res.json(results);
  } catch (err) {
    // Fallback to a simpler query if schema differs
    try {
      const simple = await query(
        `SELECT
          b.id AS booking_id,
          b.checkout_date,
          b.check_out AS checkout_time,
          r.room_number AS room_no,
          h.id AS hk_room_id,
          h.status AS hk_status,
          h.assignee
        FROM bookings b
        LEFT JOIN rooms r ON r.id = b.room_id
        LEFT JOIN housekeeping h ON h.roomNo = r.room_number
        WHERE DATE(b.checkout_date) = ?
        ORDER BY b.checkout_date DESC`,
        [targetDate]
      );
      res.json(simple);
    } catch (err2) {
      res.status(500).json({ message: "Database error", error: err2 });
    }
  }
};

// =============================================
// COMPLETED CLEANING LOGS
// =============================================
exports.getCompletedCleaningLogs = async (req, res) => {
  const { date } = req.query;
  try {
    await ensureCompletedCleaningLogSchema();
    let sql = "SELECT * FROM hk_completed_cleaning_logs";
    const params = [];
    if (date) {
      sql += " WHERE DATE(completed_at) = ?";
      params.push(date);
    }
    sql += " ORDER BY completed_at DESC, id DESC";
    const results = await query(sql, params);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch completed cleaning logs", error: err });
  }
};

exports.createCompletedCleaningLog = async (req, res) => {
  const {
    roomId,
    roomNo,
    assignee,
    guestStatus,
    finalStatus,
    completedAt,
  } = req.body;

  if (!roomNo) {
    return res.status(400).json({ message: "roomNo is required" });
  }

  try {
    await ensureCompletedCleaningLogSchema();
    const result = await query(
      `INSERT INTO hk_completed_cleaning_logs
        (room_id, room_no, assignee, guest_status, final_status, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [
        roomId || null,
        roomNo,
        assignee || null,
        guestStatus || null,
        finalStatus || "Vacant Clean",
        completedAt || new Date(),
      ]
    );
    res.json({ message: "Completed cleaning log saved", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Failed to save completed cleaning log", error: err });
  }
};
