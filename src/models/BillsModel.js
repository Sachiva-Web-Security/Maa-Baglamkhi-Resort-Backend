const pool = require('../config/db')

class Bills {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`bills\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`order_id\` BIGINT UNSIGNED,
  \`table_number\` VARCHAR(50) NOT NULL,
  \`token_id\` BIGINT UNSIGNED,
  \`entity_type\` ENUM(\'Table\',\'Room\',\'Token\',\'Takeaway\',\'Banquet\') DEFAULT \'Table\',
  \`entity_ref_id\` BIGINT UNSIGNED,
  \`waiter_name\` VARCHAR(191),
  \`customer_name\` VARCHAR(191),
  \`phone\` VARCHAR(30),
  \`subtotal\` DECIMAL(12,2) DEFAULT 0,
  \`service_charge\` DECIMAL(12,2) DEFAULT 0,
  \`tax_amount\` DECIMAL(12,2) DEFAULT 0,
  \`discount_amount\` DECIMAL(12,2) DEFAULT 0,
  \`round_off\` DECIMAL(10,2) DEFAULT 0,
  \`total\` DECIMAL(12,2) DEFAULT 0,
  \`payment_method\` ENUM(\'cash\',\'card\',\'upi\',\'wallet\',\'net_banking\',\'credit\',\'other\') DEFAULT \'cash\',
  \`payment_status\` ENUM(\'unpaid\',\'partial\',\'paid\',\'refunded\',\'cancelled\') DEFAULT \'unpaid\',
  \`paid_amount\` DECIMAL(12,2) DEFAULT 0,
  \`paid_at\` DATETIME,
  \`split_count\` INT DEFAULT 1,
  \`split_no\` INT DEFAULT 1,
  \`room_booking_id\` BIGINT UNSIGNED,
  \`room_booking_code\` VARCHAR(80),
  \`folio_entry_id\` BIGINT UNSIGNED,
  \`source_module\` VARCHAR(50),
  \`created_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_order\` (\`order_id\`),
  KEY \`idx_table\` (\`table_number\`),
  KEY \`idx_status\` (\`payment_status\`),
  KEY \`idx_created\` (\`created_at\`),
  KEY \`idx_booking\` (\`room_booking_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for bills:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByStatus(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bills\` WHERE \`payment_status\` = ? ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findByDateRange(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bills\` WHERE \`created_at\` BETWEEN ? AND ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bills\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bills\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Bills)()
