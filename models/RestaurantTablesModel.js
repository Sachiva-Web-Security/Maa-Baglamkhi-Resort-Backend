const pool = require('../config/db')

class RestaurantTables {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`restaurant_tables\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`number\` VARCHAR(50) NOT NULL UNIQUE,
  \`floor_name\` VARCHAR(80),
  \`section_name\` VARCHAR(80),
  \`seat_count\` INT DEFAULT 4,
  \`status\` ENUM(\'available\',\'occupied\',\'reserved\',\'cleaning\',\'out_of_service\') DEFAULT \'available\',
  \`status_color\` VARCHAR(30),
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`sort_order\` INT DEFAULT 0,
  PRIMARY KEY (\`id\`),
  KEY \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for restaurant_tables:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`restaurant_tables\` ORDER BY \`sort_order\`, \`number\`", args)
    return rows
  }

  async findByStatus(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`restaurant_tables\` WHERE \`status\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`restaurant_tables\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (RestaurantTables)()
