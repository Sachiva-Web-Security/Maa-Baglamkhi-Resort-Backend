const pool = require('../config/db')

class Payments {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`payments\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED,
  \`bill_id\` BIGINT UNSIGNED,
  \`invoice_id\` BIGINT UNSIGNED,
  \`banquet_booking_id\` BIGINT UNSIGNED,
  \`amount\` DECIMAL(12,2) NOT NULL,
  \`payment_method_id\` INT UNSIGNED NOT NULL,
  \`payment_type\` ENUM(\'advance\',\'payment\',\'refund\',\'balance\',\'deposit\') DEFAULT \'payment\',
  \`reference_no\` VARCHAR(100),
  \`transaction_details\` TEXT,
  \`receipt_url\` VARCHAR(500),
  \`status\` ENUM(\'pending\',\'completed\',\'failed\',\'refunded\',\'cancelled\') DEFAULT \'completed\',
  \`received_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_bill\` (\`bill_id\`),
  KEY \`idx_invoice\` (\`invoice_id\`),
  KEY \`idx_method\` (\`payment_method_id\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for payments:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`payments\` WHERE \`booking_id\` = ? ORDER BY \`created_at\`", args)
    return rows
  }

  async findCompleted(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`payments\` WHERE \`status\` = \'completed\' ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`payments\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`payments\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Payments)()
