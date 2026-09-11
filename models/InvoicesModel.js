const pool = require('../config/db')

class Invoices {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`invoices\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED,
  \`banquet_booking_id\` BIGINT UNSIGNED,
  \`invoice_no\` VARCHAR(80) NOT NULL UNIQUE,
  \`invoice_type\` ENUM(\'room\',\'restaurant\',\'banquet\',\'combined\',\'folio\') DEFAULT \'room\',
  \`invoice_date\` DATE NOT NULL,
  \`due_date\` DATE,
  \`subtotal\` DECIMAL(12,2) DEFAULT 0,
  \`service_charge\` DECIMAL(12,2) DEFAULT 0,
  \`tax_amount\` DECIMAL(12,2) DEFAULT 0,
  \`discount_amount\` DECIMAL(12,2) DEFAULT 0,
  \`round_off\` DECIMAL(10,2) DEFAULT 0,
  \`total\` DECIMAL(12,2) DEFAULT 0,
  \`paid_amount\` DECIMAL(12,2) DEFAULT 0,
  \`balance\` DECIMAL(12,2) DEFAULT 0,
  \`payment_status\` ENUM(\'unpaid\',\'partial\',\'paid\',\'overdue\',\'refunded\') DEFAULT \'unpaid\',
  \`payment_mode\` VARCHAR(50),
  \`terms_accepted\` TINYINT(1) DEFAULT 0,
  \`terms_accepted_at\` DATETIME,
  \`sent_at\` DATETIME,
  \`created_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_invoice_no\` (\`invoice_no\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_status\` (\`payment_status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for invoices:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByInvoiceNo(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`invoices\` WHERE \`invoice_no\` = ?", args)
    return rows
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`invoices\` WHERE \`booking_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`invoices\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`invoices\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Invoices)()
