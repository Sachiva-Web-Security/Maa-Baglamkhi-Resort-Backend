const { pool, getConnection } = require('../utils/poolPromise')

class BanquetPricingPlans {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`banquet_pricing_plans\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`hall_id\` INT UNSIGNED NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`min_guests\` INT,
  \`max_guests\` INT,
  \`hall_charge\` DECIMAL(12,2) DEFAULT 0,
  \`per_plate_rate\` DECIMAL(10,2) DEFAULT 0,
  \`min_hours\` INT DEFAULT 4,
  \`extra_hour_rate\` DECIMAL(10,2) DEFAULT 0,
  \`is_default\` TINYINT(1) DEFAULT 0,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_hall\` (\`hall_id\`),
  FOREIGN KEY (\`hall_id\`) REFERENCES \`banquet_halls\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for banquet_pricing_plans:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByHallId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_pricing_plans\` WHERE \`hall_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_pricing_plans\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`banquet_pricing_plans\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (BanquetPricingPlans)()
