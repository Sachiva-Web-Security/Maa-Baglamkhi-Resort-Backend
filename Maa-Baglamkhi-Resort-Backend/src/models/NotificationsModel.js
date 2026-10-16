const { pool, getConnection } = require('../utils/poolPromise')

class Notifications {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`notifications\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`user_id\` BIGINT UNSIGNED,
  \`user_role\` VARCHAR(50),
  \`type\` VARCHAR(100) NOT NULL,
  \`title\` VARCHAR(255) NOT NULL,
  \`message\` TEXT,
  \`data\` JSON,
  \`is_read\` TINYINT(1) DEFAULT 0,
  \`read_at\` DATETIME,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_user\` (\`user_id\`),
  KEY \`idx_role\` (\`user_role\`),
  KEY \`idx_read\` (\`is_read\`),
  KEY \`idx_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for notifications:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByUserId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`notifications\` WHERE \`user_id\` = ? OR \`user_role\` = ? ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findUnread(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`notifications\` WHERE \`is_read\` = 0 ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`notifications\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`notifications\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Notifications)()
