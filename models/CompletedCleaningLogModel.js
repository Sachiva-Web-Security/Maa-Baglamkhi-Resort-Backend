const db = require("../config/db");

const TABLE_NAME = "hk_completed_cleaning_logs";

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
}

module.exports = {
  TABLE_NAME,
  ensureSchema,
};
