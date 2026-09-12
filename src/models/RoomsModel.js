const pool = require('../config/db')

class Rooms {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`rooms\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`room_number\` VARCHAR(50) NOT NULL,
  \`category_id\` INT UNSIGNED NOT NULL,
  \`floor\` VARCHAR(20),
  \`building\` VARCHAR(100),
  \`status\` ENUM(\'available\',\'occupied\',\'cleaning\',\'out_of_service\',\'reserved\') DEFAULT \'available\',
  \`current_booking_id\` INT UNSIGNED NULL,
  \`notes\` TEXT,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_room_number\` (\`room_number\`),
  KEY \`idx_category\` (\`category_id\`),
  KEY \`idx_status\` (\`status\`),
  FOREIGN KEY (\`category_id\`) REFERENCES \`room_categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for rooms:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByStatus(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rooms\` WHERE \`status\` = ? ORDER BY \`room_number\`", args)
    return rows
  }

  async findAvailable(...args) {
    const [rows] = await this.pool.execute("SELECT r.*, rc.name as category_name FROM \`rooms\` r JOIN \`room_categories\` rc ON r.category_id = rc.id WHERE r.status = \'available\' AND r.category_id = ? ORDER BY r.room_number", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rooms\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rooms\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Rooms)()
