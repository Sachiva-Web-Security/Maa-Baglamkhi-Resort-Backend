const pool = require('../config/db')

class InventoryAdjustments {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_adjustments\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`inventory_item_id\` BIGINT UNSIGNED NOT NULL,
  \`adjustment_type\` ENUM(\'add\',\'remove\',\'correction\',\'damage\',\'expiry\') DEFAULT \'correction\',
  \`quantity\` DECIMAL(10,3) NOT NULL,
  \`reason\` TEXT,
  \`adjusted_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_item\` (\`inventory_item_id\`),
  KEY \`idx_created\` (\`created_at\`),
  FOREIGN KEY (\`inventory_item_id\`) REFERENCES \`inventory_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_adjustments:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByItemId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_adjustments\` WHERE \`inventory_item_id\` = ? ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_adjustments\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_adjustments\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (InventoryAdjustments)()
