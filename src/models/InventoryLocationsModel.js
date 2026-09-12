const pool = require('../config/db')

class InventoryLocations {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_locations\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(120) NOT NULL,
  \`type\` ENUM(\'store\',\'cold_storage\',\'dry_store\',\'bar\',\'kitchen\',\'bar\',\'other\') DEFAULT \'store\',
  \`building\` VARCHAR(100),
  \`floor\` VARCHAR(20),
  \`is_active\` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_locations:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_locations\` ORDER BY \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_locations\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (InventoryLocations)()
