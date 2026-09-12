const { pool, getConnection } = require('../utils/poolPromise')

class RoomRates {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`room_rates\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`category_id\` INT UNSIGNED NOT NULL,
  \`rate_plan_id\` INT UNSIGNED NOT NULL,
  \`price\` DECIMAL(10,2) NOT NULL,
  \`currency\` VARCHAR(10) DEFAULT \'INR\',
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`effective_from\` DATE,
  \`effective_to\` DATE,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_category\` (\`category_id\`),
  FOREIGN KEY (\`category_id\`) REFERENCES \`room_categories\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for room_rates:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByCategoryAndPlan(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_rates\` WHERE \`category_id\` = ? AND \`rate_plan_id\` = ? AND \`is_active\` = 1", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_rates\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_rates\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (RoomRates)()
