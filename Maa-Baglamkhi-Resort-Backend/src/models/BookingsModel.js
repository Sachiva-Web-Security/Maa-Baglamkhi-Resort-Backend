const { pool, getConnection } = require('../utils/poolPromise')

class Bookings {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`bookings\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_code\` VARCHAR(40) NOT NULL UNIQUE,
  \`source_id\` INT UNSIGNED,
  \`status\` ENUM(\'inquiry\',\'confirmed\',\'reserved\',\'checked_in\',\'checked_out\',\'cancelled\',\'no_show\') DEFAULT \'confirmed\',
  \`check_in\` DATE NOT NULL,
  \`check_out\` DATE NOT NULL,
  \`adults\` INT DEFAULT 1,
  \`children\` INT DEFAULT 0,
  \`infants\` INT DEFAULT 0,
  \`total_rooms\` INT DEFAULT 1,
  \`total_guests\` INT DEFAULT 1,
  \`subtotal\` DECIMAL(12,2) DEFAULT 0,
  \`discount_amount\` DECIMAL(12,2) DEFAULT 0,
  \`tax_amount\` DECIMAL(12,2) DEFAULT 0,
  \`total_amount\` DECIMAL(12,2) DEFAULT 0,
  \`advance_amount\` DECIMAL(12,2) DEFAULT 0,
  \`balance_amount\` DECIMAL(12,2) DEFAULT 0,
  \`currency\` VARCHAR(10) DEFAULT \'INR\',
  \`cancellation_reason\` TEXT,
  \`special_requests\` TEXT,
  \`created_by\` BIGINT UNSIGNED,
  \`cancelled_by\` BIGINT UNSIGNED,
  \`cancelled_at\` DATETIME NULL,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking_code\` (\`booking_code\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_source\` (\`source_id\`),
  KEY \`idx_created_by\` (\`created_by\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for bookings:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByCode(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bookings\` WHERE \`booking_code\` = ?", args)
    return rows
  }

  async findUpcoming(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bookings\` WHERE \`status\` IN (\'confirmed\',\'reserved\',\'checked_in\') AND \`check_out\` >= CURDATE() ORDER BY \`check_in\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bookings\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bookings\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Bookings)()
