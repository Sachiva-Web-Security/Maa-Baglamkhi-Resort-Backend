const { pool, getConnection } = require('../utils/poolPromise')

class InventoryPurchaseItems {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_purchase_items\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`purchase_id\` BIGINT UNSIGNED NOT NULL,
  \`inventory_item_id\` BIGINT UNSIGNED NOT NULL,
  \`quantity\` DECIMAL(10,3) NOT NULL,
  \`unit_cost\` DECIMAL(10,2) NOT NULL,
  \`tax_percent\` DECIMAL(5,2) DEFAULT 0,
  \`tax_amount\` DECIMAL(10,2) DEFAULT 0,
  \`total\` DECIMAL(12,2) NOT NULL,
  \`batch_no\` VARCHAR(100),
  \`expiry_date\` DATE,
  PRIMARY KEY (\`id\`),
  KEY \`idx_purchase\` (\`purchase_id\`),
  KEY \`idx_item\` (\`inventory_item_id\`),
  FOREIGN KEY (\`purchase_id\`) REFERENCES \`inventory_purchases\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_purchase_items:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByPurchaseId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_purchase_items\` WHERE \`purchase_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_purchase_items\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (InventoryPurchaseItems)()
