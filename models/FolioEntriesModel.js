const pool = require('../config/db')

class FolioEntries {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`folio_entries\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED NOT NULL,
  \`booking_room_id\` BIGINT UNSIGNED,
  \`entry_date\` DATE NOT NULL,
  \`entry_type\` ENUM(\'room_charge\',\'extra_charge\',\'discount\',\'payment\',\'refund\',\'adjustment\',\'food\',\'beverage\',\'service\') DEFAULT \'miscellaneous\',
  \`category\` VARCHAR(100) DEFAULT \'Miscellaneous\',
  \`description\` VARCHAR(255) NOT NULL,
  \`amount\` DECIMAL(12,2) NOT NULL,
  \`reference_id\` BIGINT UNSIGNED,
  \`reference_type\` VARCHAR(50),
  \`created_by\` VARCHAR(100) DEFAULT \'Front Desk\',
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_room\` (\`booking_room_id\`),
  KEY \`idx_date\` (\`entry_date\`),
  KEY \`idx_type\` (\`entry_type\`),
  FOREIGN KEY (\`booking_id\`) REFERENCES \`bookings\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for folio_entries:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`folio_entries\` WHERE \`booking_id\` = ? ORDER BY \`entry_date\`, \`id\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`folio_entries\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`folio_entries\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (FolioEntries)()
