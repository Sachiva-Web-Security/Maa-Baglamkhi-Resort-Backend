const pool = require('../config/db')

class Promotions {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`promotions\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(191) NOT NULL,
  \`code\` VARCHAR(50) UNIQUE,
  \`description\` TEXT,
  \`type\` ENUM(\'percentage\',\'fixed_amount\',\'free_night\',\'upgrade\',\'other\') DEFAULT \'percentage\',
  \`value\` DECIMAL(10,2) NOT NULL,
  \`max_discount\` DECIMAL(10,2),
  \`applicable_categories\` JSON,
  \`min_nights\` INT DEFAULT 1,
  \`max_nights\` INT,
  \`min_advance_days\` INT,
  \`valid_from\` DATE NOT NULL,
  \`valid_to\` DATE NOT NULL,
  \`max_redemptions\` INT,
  \`used_count\` INT DEFAULT 0,
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_code\` (\`code\`),
  KEY \`idx_active\` (\`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for promotions:', err.message)
    } finally {
      conn.release()
    }
  }

  async findActive(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`promotions\` WHERE \`is_active\` = 1 AND \`valid_from\` <= CURDATE() AND \`valid_to\` >= CURDATE()", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`promotions\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`promotions\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Promotions)()
