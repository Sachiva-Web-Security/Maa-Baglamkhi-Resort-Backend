const pool = require('../config/db')

class PrintLogs {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`print_logs\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`print_type\` VARCHAR(50) NOT NULL,
  \`reference_id\` BIGINT UNSIGNED,
  \`reference_type\` VARCHAR(50),
  \`status\` ENUM(\'pending\',\'printing\',\'completed\',\'failed\',\'cancelled\') DEFAULT \'pending\',
  \`printer_name\` VARCHAR(100),
  \`error_message\` TEXT,
  \`printed_by\` BIGINT UNSIGNED,
  \`printed_at\` DATETIME,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for print_logs:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByStatus(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`print_logs\` WHERE \`status\` = ? ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`print_logs\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`print_logs\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (PrintLogs)()
