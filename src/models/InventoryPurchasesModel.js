const { pool, getConnection } = require('../utils/poolPromise')

class InventoryPurchases {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_purchases\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`vendor_id\` INT UNSIGNED,
  \`purchase_no\` VARCHAR(80) NOT NULL UNIQUE,
  \`purchase_date\` DATE NOT NULL,
  \`total_amount\` DECIMAL(12,2) DEFAULT 0,
  \`paid_amount\` DECIMAL(12,2) DEFAULT 0,
  \`status\` ENUM(\'draft\',\'ordered\',\'received\',\'completed\',\'cancelled\') DEFAULT \'draft\',
  \`notes\` TEXT,
  \`received_by\` BIGINT UNSIGNED,
  \`created_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_vendor\` (\`vendor_id\`),
  KEY \`idx_date\` (\`purchase_date\`),
  KEY \`idx_status\` (\`status\`),
  FOREIGN KEY (\`vendor_id\`) REFERENCES \`inventory_vendors\`(\`id\`) ON DELETE SET ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_purchases:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_purchases\` ORDER BY \`purchase_date\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_purchases\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (InventoryPurchases)()
