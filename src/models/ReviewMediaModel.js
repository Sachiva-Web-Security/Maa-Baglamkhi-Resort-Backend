const pool = require('../config/db')

class ReviewMedia {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`review_media\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`review_id\` BIGINT UNSIGNED NOT NULL,
  \`media_type\` ENUM(\'image\',\'video\') DEFAULT \'image\',
  \`url\` VARCHAR(500) NOT NULL,
  \`caption\` VARCHAR(255),
  \`sort_order\` INT DEFAULT 0,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_review\` (\`review_id\`),
  FOREIGN KEY (\`review_id\`) REFERENCES \`guest_reviews\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for review_media:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByReviewId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`review_media\` WHERE \`review_id\` = ? ORDER BY \`sort_order\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`review_media\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`review_media\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (ReviewMedia)()
