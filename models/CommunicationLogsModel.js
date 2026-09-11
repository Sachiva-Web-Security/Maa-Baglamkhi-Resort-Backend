const pool = require('../config/db')

class CommunicationLogs {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`communication_logs\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`channel\` ENUM(\'sms\',\'whatsapp\',\'email\',\'call\') NOT NULL,
  \`recipient_phone\` VARCHAR(30),
  \`recipient_email\` VARCHAR(191),
  \`subject\` VARCHAR(255),
  \`message_body\` TEXT,
  \`template_id\` VARCHAR(100),
  \`status\` ENUM(\'pending\',\'sent\',\'delivered\',\'read\',\'failed\',\'bounced\') DEFAULT \'pending\',
  \`provider_response\` JSON,
  \`sent_by\` BIGINT UNSIGNED,
  \`sent_at\` DATETIME,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_channel\` (\`channel\`),
  KEY \`idx_recipient\` (\`recipient_phone\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for communication_logs:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByChannel(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`communication_logs\` WHERE \`channel\` = ? ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`communication_logs\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`communication_logs\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (CommunicationLogs)()
