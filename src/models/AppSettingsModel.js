const { pool, getConnection } = require('../utils/poolPromise')

class AppSettings {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`app_settings\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`key\` VARCHAR(100) NOT NULL UNIQUE,
  \`value\` JSON,
  \`description\` TEXT,
  \`updated_by\` BIGINT UNSIGNED,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_key\` (\`key\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for app_settings:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByKey(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`app_settings\` WHERE \`key\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`app_settings\` ORDER BY \`key\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`app_settings\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (AppSettings)()
