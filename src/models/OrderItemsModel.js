const { pool, getConnection } = require('../utils/poolPromise')

class OrderItems {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`order_items\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`order_id\` BIGINT UNSIGNED NOT NULL,
  \`menu_item_id\` INT UNSIGNED,
  \`name\` VARCHAR(191) NOT NULL,
  \`quantity\` INT NOT NULL DEFAULT 1,
  \`unit_price\` DECIMAL(10,2) NOT NULL,
  \`tax_percent\` DECIMAL(5,2) DEFAULT 0,
  \`tax_amount\` DECIMAL(10,2) DEFAULT 0,
  \`total\` DECIMAL(12,2) NOT NULL,
  \`notes\` VARCHAR(255),
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_order\` (\`order_id\`),
  KEY \`idx_menu_item\` (\`menu_item_id\`),
  FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for order_items:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByOrderId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`order_items\` WHERE \`order_id\` = ? ORDER BY \`id\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`order_items\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`order_items\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (OrderItems)()
