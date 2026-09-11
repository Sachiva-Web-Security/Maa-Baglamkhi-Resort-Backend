const pool = require('../config/db')

class Tokens {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`tokens\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`token_code\` VARCHAR(40) NOT NULL UNIQUE,
  \`table_id\` INT UNSIGNED,
  \`table_number\` VARCHAR(50),
  \`waiter_id\` BIGINT UNSIGNED,
  \`waiter_name\` VARCHAR(191),
  \`status\` ENUM(\'active\',\'completed\',\'cancelled\',\'expired\') DEFAULT \'active\',
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_code\` (\`token_code\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_table\` (\`table_number\`),
  FOREIGN KEY (\`table_id\`) REFERENCES \`restaurant_tables\`(\`id\`) ON DELETE SET ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for tokens:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByCode(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` WHERE \`token_code\` = ?", args)
    return rows
  }

  async findActiveByTable(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` WHERE \`table_number\` = ? AND \`status\` = \'active\'", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Tokens)()
