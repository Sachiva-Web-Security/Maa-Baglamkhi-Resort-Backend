const { pool, getConnection } = require('../utils/poolPromise')

class MenuItemIngredients {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`menu_item_ingredients\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`menu_item_id\` INT UNSIGNED NOT NULL,
  \`inventory_item_id\` BIGINT UNSIGNED NOT NULL,
  \`quantity\` DECIMAL(10,3) NOT NULL,
  \`unit\` VARCHAR(60),
  \`wastage_percent\` DECIMAL(5,2) DEFAULT 0,
  \`is_optional\` TINYINT(1) DEFAULT 0,
  \`notes\` TEXT,
  \`sort_order\` INT DEFAULT 0,
  PRIMARY KEY (\`id\`),
  KEY \`idx_menu_item\` (\`menu_item_id\`),
  KEY \`idx_inventory\` (\`inventory_item_id\`),
  FOREIGN KEY (\`menu_item_id\`) REFERENCES \`menu_items\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for menu_item_ingredients:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByMenuItemId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`menu_item_ingredients\` WHERE \`menu_item_id\` = ? ORDER BY \`sort_order\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`menu_item_ingredients\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (MenuItemIngredients)()
