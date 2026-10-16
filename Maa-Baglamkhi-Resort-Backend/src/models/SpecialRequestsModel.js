const { pool, getConnection } = require('../utils/poolPromise')

class SpecialRequests {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`special_requests\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED NOT NULL,
  \`request_type\` ENUM(\'early_checkin\',\'late_checkout\',\'anniversary\',\'birthday\',\'honeymoon\',\'dietary\',\'accessibility\',\'other\') DEFAULT \'other\',
  \`description\` TEXT,
  \`status\` ENUM(\'pending\',\'acknowledged\',\'fulfilled\',\'unavailable\') DEFAULT \'pending\',
  \`handled_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for special_requests:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`special_requests\` WHERE \`booking_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`special_requests\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`special_requests\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (SpecialRequests)()
