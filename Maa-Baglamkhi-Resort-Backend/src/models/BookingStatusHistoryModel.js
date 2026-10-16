const { pool, getConnection } = require('../utils/poolPromise')

class BookingStatusHistory {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`booking_status_history\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED NOT NULL,
  \`from_status\` VARCHAR(50),
  \`to_status\` VARCHAR(50) NOT NULL,
  \`changed_by\` BIGINT UNSIGNED,
  \`remarks\` TEXT,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_created\` (\`created_at\`),
  FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for booking_status_history:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`booking_status_history\` WHERE \`booking_id\` = ? ORDER BY \`created_at\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`booking_status_history\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`booking_status_history\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (BookingStatusHistory)()
