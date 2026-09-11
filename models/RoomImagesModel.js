const pool = require('../config/db')

class RoomImages {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`room_images\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`category_id\` INT UNSIGNED NOT NULL,
  \`url\` VARCHAR(500) NOT NULL,
  \`alt_text\` VARCHAR(255),
  \`sort_order\` INT DEFAULT 0,
  \`is_primary\` TINYINT(1) DEFAULT 0,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_category\` (\`category_id\`),
  FOREIGN KEY (\`category_id\`) REFERENCES \`room_categories\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for room_images:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByCategory(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_images\` WHERE \`category_id\` = ? ORDER BY \`sort_order\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_images\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_images\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (RoomImages)()
