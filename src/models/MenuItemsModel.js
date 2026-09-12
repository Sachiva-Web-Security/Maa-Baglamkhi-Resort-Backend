const { pool, getConnection } = require('../utils/poolPromise')

class MenuItems {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`menu_items\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`category_id\` INT UNSIGNED NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`description\` TEXT,
  \`price\` DECIMAL(10,2) NOT NULL,
  \`tax_percent\` DECIMAL(5,2) DEFAULT 5.00,
  \`food_type\` ENUM(\'Veg\',\'Non-Veg\',\'Egg\',\' Jain\') DEFAULT \'Veg\',
  \`status\` ENUM(\'available\',\'unavailable\',\'seasonal\') DEFAULT \'available\',
  \`image_url\` VARCHAR(500),
  \`is_featured\` TINYINT(1) DEFAULT 0,
  \`prep_time_minutes\` INT DEFAULT 15,
  \`sort_order\` INT DEFAULT 0,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_category\` (\`category_id\`),
  KEY \`idx_status\` (\`status\`),
  FOREIGN KEY (\`category_id\`) REFERENCES \`menu_categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for menu_items:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAllAvailable(...args) {
    const [rows] = await this.pool.execute("SELECT mi.*, mc.name as category_name FROM \`menu_items\` mi JOIN \`menu_categories\` mc ON mi.category_id = mc.id WHERE mi.status = \'available\' ORDER BY mc.sort_order, mi.sort_order", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`menu_items\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`menu_items\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (MenuItems)()
