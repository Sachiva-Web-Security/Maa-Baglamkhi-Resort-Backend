const pool = require('../config/db')

class BookingGuests {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`booking_guests\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED NOT NULL,
  \`guest_profile_id\` BIGINT UNSIGNED,
  \`is_primary\` TINYINT(1) DEFAULT 0,
  \`first_name\` VARCHAR(120) NOT NULL,
  \`last_name\` VARCHAR(120),
  \`age\` INT,
  \`relationship\` VARCHAR(50),
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_guest\` (\`guest_profile_id\`),
  FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for booking_guests:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`booking_guests\` WHERE \`booking_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`booking_guests\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (BookingGuests)()
