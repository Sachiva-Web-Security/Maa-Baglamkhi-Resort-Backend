const pool = require('../config/db')

class BanquetBookingAddons {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`banquet_booking_addons\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED NOT NULL,
  \`addon_type\` ENUM(\'lighting\',\'decoration\',\'event_support\',\'custom_menu\',\'other\') NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`description\` TEXT,
  \`amount\` DECIMAL(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  FOREIGN KEY (\`booking_id\`) REFERENCES \`banquet_bookings\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for banquet_booking_addons:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_booking_addons\` WHERE \`booking_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_booking_addons\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (BanquetBookingAddons)()
