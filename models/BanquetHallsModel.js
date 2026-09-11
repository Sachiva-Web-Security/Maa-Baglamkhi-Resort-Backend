const pool = require('../config/db')

class BanquetHalls {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`banquet_halls\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(191) NOT NULL,
  \`description\` TEXT,
  \`capacity_min\` INT DEFAULT 10,
  \`capacity_max\` INT DEFAULT 200,
  \`area_sqft\` INT,
  \`rate_per_hour\` DECIMAL(10,2) DEFAULT 0,
  \`rate_per_day\` DECIMAL(10,2) DEFAULT 0,
  \`is_ac\` TINYINT(1) DEFAULT 0,
  \`has_projector\` TINYINT(1) DEFAULT 0,
  \`has_sound_system\` TINYINT(1) DEFAULT 0,
  \`has_stage\` TINYINT(1) DEFAULT 0,
  \`has_dance_floor\` TINYINT(1) DEFAULT 0,
  \`image_url\` VARCHAR(500),
  \`status\` ENUM(\'available\',\'booked\',\'maintenance\') DEFAULT \'available\',
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for banquet_halls:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_halls\` ORDER BY \`name\`", args)
    return rows
  }

  async findAvailable(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_halls\` WHERE \`status\` = \'available\'", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_halls\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (BanquetHalls)()
