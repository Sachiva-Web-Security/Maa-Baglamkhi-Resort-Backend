const { pool, getConnection } = require('../utils/poolPromise')

class GuestReviews {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`guest_reviews\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`booking_id\` BIGINT UNSIGNED,
  \`guest_profile_id\` BIGINT UNSIGNED,
  \`overall_rating\` DECIMAL(2,1) NOT NULL,
  \`cleanliness_rating\` DECIMAL(2,1),
  \`service_rating\` DECIMAL(2,1),
  \`location_rating\` DECIMAL(2,1),
  \`value_rating\` DECIMAL(2,1),
  \`review_title\` VARCHAR(255),
  \`review_text\` TEXT,
  \`is_published\` TINYINT(1) DEFAULT 0,
  \`published_at\` DATETIME,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_booking\` (\`booking_id\`),
  KEY \`idx_guest\` (\`guest_profile_id\`),
  KEY \`idx_published\` (\`is_published\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for guest_reviews:', err.message)
    } finally {
      conn.release()
    }
  }

  async findPublished(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_reviews\` WHERE \`is_published\` = 1 ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_reviews\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_reviews\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (GuestReviews)()
