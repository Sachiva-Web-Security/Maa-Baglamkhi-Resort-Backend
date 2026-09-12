const { pool, getConnection } = require('../utils/poolPromise')

class BanquetBookings {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`banquet_bookings\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED,
  \`hall_id\` INT UNSIGNED NOT NULL,
  \`customer_name\` VARCHAR(191) NOT NULL,
  \`phone\` VARCHAR(50) NOT NULL,
  \`email\` VARCHAR(191),
  \`event_title\` VARCHAR(191) NOT NULL,
  \`event_type\` VARCHAR(100),
  \`guest_count\` INT,
  \`menu_package\` VARCHAR(100),
  \`meal_section\` VARCHAR(100),
  \`custom_menu_items\` TEXT,
  \`lighting_system\` VARCHAR(100),
  \`decoration_fee\` DECIMAL(12,2) DEFAULT 0,
  \`event_support_fee\` DECIMAL(12,2) DEFAULT 0,
  \`lighting_charge\` DECIMAL(12,2) DEFAULT 0,
  \`custom_menu_charge\` DECIMAL(12,2) DEFAULT 0,
  \`hall_charge\` DECIMAL(12,2) DEFAULT 0,
  \`meal_charge\` DECIMAL(12,2) DEFAULT 0,
  \`subtotal\` DECIMAL(12,2) DEFAULT 0,
  \`discount\` DECIMAL(12,2) DEFAULT 0,
  \`gst_percent\` DECIMAL(5,2) DEFAULT 5.00,
  \`gst_amount\` DECIMAL(12,2) DEFAULT 0,
  \`total\` DECIMAL(12,2) DEFAULT 0,
  \`advance\` DECIMAL(12,2) DEFAULT 0,
  \`balance\` DECIMAL(12,2) DEFAULT 0,
  \`event_date\` DATE NOT NULL,
  \`start_time\` TIME NOT NULL,
  \`end_time\` TIME NOT NULL,
  \`status\` ENUM(\'inquiry\',\'confirmed\',\'in_progress\',\'completed\',\'cancelled\') DEFAULT \'confirmed\',
  \`invoice_no\` VARCHAR(100),
  \`created_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_created\` (\`created_at\`),
  FOREIGN KEY (\`hall_id\`) REFERENCES \`banquet_halls\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for banquet_bookings:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByHallAndDate(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_bookings\` WHERE \`hall_id\` = ? AND \`event_date\` = ? AND \`status\` NOT IN (\'cancelled\')", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_bookings\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_bookings\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (BanquetBookings)()
