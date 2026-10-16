const { pool, getConnection } = require('../utils/poolPromise')

class PromoUsages {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`promo_usages\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`promotion_id\` BIGINT UNSIGNED NOT NULL,
  \`booking_id\` BIGINT UNSIGNED NOT NULL,
  \`discount_amount\` DECIMAL(12,2) NOT NULL,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_promo\` (\`promotion_id\`),
  FOREIGN KEY (\`promotion_id\`) REFERENCES \`promotions\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for promo_usages:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBookingId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`promo_usages\` WHERE \`booking_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`promo_usages\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`promo_usages\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (PromoUsages)()
