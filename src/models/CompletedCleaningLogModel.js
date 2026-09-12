const db = require("../config/db");

const TABLE_NAME = "hk_completed_cleaning_logs";

async function columnExists(tableName, columnName) {
  const [rows] = await db.promise().query(
    `SHOW COLUMNS FROM ${tableName} LIKE ?`,
    [columnName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureSchema() {
  await db.promise().query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT NOT NULL AUTO_INCREMENT,
      room_id VARCHAR(100) NULL,
      room_no VARCHAR(100) NOT NULL,
      assignee VARCHAR(255) NULL,
      guest_status VARCHAR(255) NULL,
      final_status VARCHAR(100) NOT NULL DEFAULT 'Vacant Clean',
      completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_hk_completed_room_no (room_no),
      INDEX idx_hk_completed_assignee (assignee),
      INDEX idx_hk_completed_at (completed_at)
    )
  `);

  // Verify/approval columns — added by the Assigned -> In Progress -> Completed -> Verified pipeline.
  // All nullable; legacy rows + old callers keep working unchanged.
  if (!(await columnExists(TABLE_NAME, "verified_at"))) {
    await db.promise().query(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN verified_at DATETIME NULL`,
    );
  }

  if (!(await columnExists(TABLE_NAME, "verified_by_user_id"))) {
    await db.promise().query(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN verified_by_user_id INT NULL`,
    );
  }

  if (!(await columnExists(TABLE_NAME, "verified_by_name"))) {
    await db.promise().query(
      `ALTER TABLE ${TABLE_NAME} ADD COLUMN verified_by_name VARCHAR(120) NULL`,
    );
  }
}

module.exports = {
  TABLE_NAME,
  ensureSchema,
};