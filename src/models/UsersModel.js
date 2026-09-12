const { pool, getConnection } = require('../utils/poolPromise')

class Users {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`users\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(191) NOT NULL,
  \`email\` VARCHAR(191) UNIQUE,
  \`phone\` VARCHAR(30),
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`role_id\` INT UNSIGNED NOT NULL DEFAULT 4,
  \`avatar_url\` VARCHAR(500),
  \`status\` ENUM(\'active\',\'inactive\',\'suspended\') DEFAULT \'active\',
  \`last_login_at\` DATETIME NULL,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_email\` (\`email\`),
  KEY \`idx_phone\` (\`phone\`),
  KEY \`idx_role\` (\`role_id\`),
  KEY \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for users:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByEmail(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`users\` WHERE \`email\` = ? AND \`status\` = \'active\'", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`users\` WHERE \`id\` = ?", args)
    return rows
  }

  async findByPhone(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`users\` WHERE \`phone\` = ? AND \`status\` = \'active\'", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`users\` ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findAdminUser(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`users\` ORDER BY \`id\` ASC LIMIT 1", args)
    return rows
  }

  async findAdminWithPhone(...args) {
    // First try to find a user with phone, falling back to first user if none
    const [withPhone] = await this.pool.execute(
      "SELECT * FROM \`users\` WHERE \`phone\` IS NOT NULL AND TRIM(phone) <> '' ORDER BY \`id\` ASC LIMIT 1",
      args
    )
    if (withPhone.length) return withPhone
    const [anyUser] = await this.pool.execute("SELECT * FROM \`users\` ORDER BY \`id\` ASC LIMIT 1", args)
    return anyUser
  }
}

module.exports = new (Users)()
