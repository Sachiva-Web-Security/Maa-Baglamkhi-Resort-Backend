/**
 * roomBlockModel.js
 * Manages hotel_room_blocks table for maintenance scheduling.
 */

const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS hotel_room_blocks (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      room_number   VARCHAR(50) NOT NULL,
      block_type    ENUM(
                      'Maintenance','Deep Clean','Renovation',
                      'Inspection','Pest Control','Other'
                    ) NOT NULL DEFAULT 'Maintenance',
      reason        TEXT DEFAULT NULL,
      blocked_from  DATE NOT NULL,
      blocked_until DATE NOT NULL,
      blocked_by    VARCHAR(100) DEFAULT 'Manager',
      status        ENUM('Active','Completed','Cancelled')
                    NOT NULL DEFAULT 'Active',
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

// ─── Get all blocks (optionally filter by status) ──────────────────────────
const getAllBlocks = async (status = null) => {
  await ensureSchema();
  if (status) {
    return runQuery(
      "SELECT * FROM hotel_room_blocks WHERE status = ? ORDER BY blocked_from DESC",
      [status],
    );
  }
  return runQuery(
    "SELECT * FROM hotel_room_blocks ORDER BY blocked_from DESC",
  );
};

// ─── Create a block ────────────────────────────────────────────────────────
const createBlock = async ({
  room_number,
  block_type = "Maintenance",
  reason = null,
  blocked_from,
  blocked_until,
  blocked_by = "Manager",
}) => {
  await ensureSchema();

  if (!room_number || !blocked_from || !blocked_until) {
    throw new Error("room_number, blocked_from, and blocked_until are required");
  }

  const result = await runQuery(
    `INSERT INTO hotel_room_blocks
       (room_number, block_type, reason, blocked_from, blocked_until, blocked_by, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
    [room_number, block_type, reason, blocked_from, blocked_until, blocked_by],
  );
  return { id: result.insertId, room_number, block_type, status: "Active" };
};

// ─── Update block status ───────────────────────────────────────────────────
const updateBlockStatus = async (blockId, status) => {
  await ensureSchema();
  const validStatuses = ["Active", "Completed", "Cancelled"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  await runQuery(
    "UPDATE hotel_room_blocks SET status = ? WHERE id = ?",
    [status, blockId],
  );
};

// ─── Check if a room is blocked on a date range ───────────────────────────
const isRoomBlocked = async (roomNumber, fromDate, toDate) => {
  await ensureSchema();
  const rows = await runQuery(
    `SELECT id FROM hotel_room_blocks
     WHERE room_number = ?
       AND status = 'Active'
       AND blocked_from <= ?
       AND blocked_until >= ?
     LIMIT 1`,
    [roomNumber, toDate, fromDate],
  );
  return rows.length > 0;
};

module.exports = {
  ensureSchema,
  getAllBlocks,
  createBlock,
  updateBlockStatus,
  isRoomBlocked,
};
