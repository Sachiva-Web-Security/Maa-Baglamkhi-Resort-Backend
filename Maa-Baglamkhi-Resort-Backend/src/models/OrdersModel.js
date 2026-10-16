const { pool, getConnection } = require('../utils/poolPromise')

class Orders {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`orders\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`table_id\` INT UNSIGNED,
  \`table_number\` VARCHAR(50) NOT NULL,
  \`token_id\` BIGINT UNSIGNED,
  \`waiter_id\` BIGINT UNSIGNED,
  \`waiter_name\` VARCHAR(191),
  \`entity_type\` ENUM(\'Table\',\'Room\',\'Token\',\'Takeaway\') DEFAULT \'Table\',
  \`entity_ref_id\` BIGINT UNSIGNED,
  \`status\` ENUM(\'pending\',\'confirmed\',\'preparing\',\'ready\',\'served\',\'completed\',\'cancelled\') DEFAULT \'pending\',
  \`subtotal\` DECIMAL(12,2) DEFAULT 0,
  \`tax_amount\` DECIMAL(12,2) DEFAULT 0,
  \`discount_amount\` DECIMAL(12,2) DEFAULT 0,
  \`total_amount\` DECIMAL(12,2) DEFAULT 0,
  \`notes\` TEXT,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_table\` (\`table_number\`),
  KEY \`idx_token\` (\`token_id\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_created\` (\`created_at\`),
  FOREIGN KEY (\`waiter_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for orders:', err.message)
    } finally {
      conn.release()
    }
  }

  async findActive(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`orders\` WHERE \`status\` NOT IN (\'completed\',\'cancelled\') ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findByTable(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`orders\` WHERE \`table_number\` = ? AND \`status\` NOT IN (\'completed\',\'cancelled\') ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`orders\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`orders\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Orders)()
