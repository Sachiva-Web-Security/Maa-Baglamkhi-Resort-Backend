const pool = require('../config/db')

class AuditLogs {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`audit_logs\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`user_id\` BIGINT UNSIGNED,
  \`user_name\` VARCHAR(191),
  \`user_role\` VARCHAR(50),
  \`action\` VARCHAR(100) NOT NULL,
  \`module\` VARCHAR(50) NOT NULL,
  \`endpoint\` VARCHAR(255),
  \`http_method\` VARCHAR(10),
  \`request_data\` JSON,
  \`response_status\` INT,
  \`old_value\` JSON,
  \`new_value\` JSON,
  \`ip_address\` VARCHAR(64),
  \`user_agent\` VARCHAR(255),
  \`created_at\` DATETIME,
  PRIMARY KEY (\`id\`),
  KEY \`idx_user\` (\`user_id\`),
  KEY \`idx_module\` (\`module\`),
  KEY \`idx_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for audit_logs:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByModule(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`audit_logs\` WHERE \`module\` = ? ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findByUserId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`audit_logs\` WHERE \`user_id\` = ? ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`audit_logs\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`audit_logs\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (AuditLogs)()
