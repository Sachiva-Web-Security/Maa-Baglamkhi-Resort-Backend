const { pool, getConnection } = require('../utils/poolPromise')

class InventoryConsumption {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_consumption\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`inventory_item_id\` BIGINT UNSIGNED NOT NULL,
  \`quantity\` DECIMAL(10,3) NOT NULL,
  \`unit\` VARCHAR(60),
  \`reference_type\` ENUM(\'order\',\'manual\',\'adjustment\',\'recipe\',\'other\') DEFAULT \'manual\',
  \`reference_id\` VARCHAR(120),
  \`remarks\` TEXT,
  \`consumed_by\` VARCHAR(120),
  \`consumed_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_item\` (\`inventory_item_id\`),
  KEY \`idx_consumed\` (\`consumed_at\`),
  FOREIGN KEY (\`inventory_item_id\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_consumption:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByItemId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_consumption\` WHERE \`inventory_item_id\` = ? ORDER BY \`consumed_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_consumption\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (InventoryConsumption)()
