const { pool, getConnection } = require('../utils/poolPromise')

class InventoryStock {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_stock\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`inventory_item_id\` BIGINT UNSIGNED NOT NULL,
  \`location_id\` INT UNSIGNED,
  \`batch_no\` VARCHAR(100),
  \`expiry_date\` DATE,
  \`quantity\` DECIMAL(10,3) DEFAULT 0,
  \`unit_cost\` DECIMAL(10,2) DEFAULT 0,
  \`last_restocked\` DATETIME,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_item\` (\`inventory_item_id\`),
  KEY \`idx_location\` (\`location_id\`),
  KEY \`idx_batch\` (\`batch_no\`),
  FOREIGN KEY (\`inventory_item_id\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_stock:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByItem(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_stock\` WHERE \`inventory_item_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_stock\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_stock\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (InventoryStock)()
