const { pool, getConnection } = require('../utils/poolPromise')

class InventoryItems {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_items\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(191) NOT NULL,
  \`category_id\` INT UNSIGNED,
  \`sku\` VARCHAR(100) UNIQUE,
  \`unit_id\` INT UNSIGNED,
  \`vendor_id\` INT UNSIGNED,
  \`unit_cost\` DECIMAL(10,2) DEFAULT 0,
  \`selling_price\` DECIMAL(10,2) DEFAULT 0,
  \`reorder_level\` DECIMAL(10,3) DEFAULT 0,
  \`reorder_quantity\` DECIMAL(10,3) DEFAULT 0,
  \`hsn_code\` VARCHAR(20),
  \`tax_percent\` DECIMAL(5,2) DEFAULT 0,
  \`is_perishable\` TINYINT(1) DEFAULT 0,
  \`shelf_life_days\` INT,
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_category\` (\`category_id\`),
  KEY \`idx_sku\` (\`sku\`),
  KEY \`idx_vendor\` (\`vendor_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_items:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_items\` ORDER BY \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_items\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (InventoryItems)()
