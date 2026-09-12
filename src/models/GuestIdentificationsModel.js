const pool = require('../config/db')

class GuestIdentifications {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`guest_identifications\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED,
  \`guest_profile_id\` BIGINT UNSIGNED,
  \`id_type\` ENUM(\'aadhaar\',\'passport\',\'driving_license\',\'voter_id\',\'other\') NOT NULL,
  \`id_number\` VARCHAR(100) NOT NULL,
  \`file_url\` VARCHAR(500),
  \`verified\` TINYINT(1) DEFAULT 0,
  \`verified_by\` BIGINT UNSIGNED,
  \`verified_at\` DATETIME,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_guest\` (\`guest_profile_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for guest_identifications:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_identifications\` WHERE \`booking_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_identifications\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_identifications\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (GuestIdentifications)()
