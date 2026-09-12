const { pool, getConnection } = require('../utils/poolPromise')

class UserSessions {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`user_sessions\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`user_id\` BIGINT UNSIGNED NOT NULL,
  \`token_jti\` VARCHAR(64) NOT NULL,
  \`ip_address\` VARCHAR(64),
  \`user_agent\` VARCHAR(255),
  \`expires_at\` DATETIME NOT NULL,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_user\` (\`user_id\`),
  KEY \`idx_jti\` (\`token_jti\`),
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for user_sessions:', err.message)
    } finally {
      conn.release()
    }
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`user_sessions\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`user_sessions\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (UserSessions)()
