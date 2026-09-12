const { pool, getConnection } = require('../utils/poolPromise')

class KotOrders {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`kot_orders\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`order_id\` BIGINT UNSIGNED NOT NULL,
  \`table_number\` VARCHAR(50) NOT NULL,
  \`waiter_name\` VARCHAR(191),
  \`entity_type\` ENUM(\'Table\',\'Room\',\'Token\',\'Takeaway\') DEFAULT \'Table\',
  \`items\` JSON NOT NULL,
  \`status\` ENUM(\'pending\',\'preparing\',\'ready\',\'completed\',\'cancelled\') DEFAULT \'pending\',
  \`prep_time_minutes\` INT DEFAULT 20,
  \`expected_ready_at\` DATETIME,
  \`ready_at\` DATETIME,
  \`ready_message\` VARCHAR(255),
  \`kot_no\` VARCHAR(100),
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_order\` (\`order_id\`),
  KEY \`idx_table\` (\`table_number\`),
  KEY \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for kot_orders:', err.message)
    } finally {
      conn.release()
    }
  }

  async findPending(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`kot_orders\` WHERE \`status\` IN (\'pending\',\'preparing\') ORDER BY \`created_at\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`kot_orders\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`kot_orders\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (KotOrders)()
