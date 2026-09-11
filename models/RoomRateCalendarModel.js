const pool = require('../config/db')

class RoomRateCalendar {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`room_rate_calendar\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`category_id\` INT UNSIGNED NOT NULL,
  \`rate_plan_id\` INT UNSIGNED NOT NULL,
  \`date\` DATE NOT NULL,
  \`price\` DECIMAL(10,2) NOT NULL,
  \`min_nights\` INT DEFAULT 1,
  \`max_nights\` INT DEFAULT 30,
  \`stop_sell\` TINYINT(1) DEFAULT 0,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  FOREIGN KEY (\`category_id\`) REFERENCES \`room_categories\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for room_rate_calendar:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByDateRange(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_rate_calendar\` WHERE \`category_id\` = ? AND \`date\` BETWEEN ? AND ? AND \`stop_sell\` = 0", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_rate_calendar\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_rate_calendar\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (RoomRateCalendar)()
