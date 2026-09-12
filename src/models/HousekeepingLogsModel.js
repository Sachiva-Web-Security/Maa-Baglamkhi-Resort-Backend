const { pool, getConnection } = require('../utils/poolPromise')

class HousekeepingLogs {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`housekeeping_logs\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`room_id\` VARCHAR(100),
  \`room_number\` VARCHAR(50) NOT NULL,
  \`assignment_id\` BIGINT UNSIGNED,
  \`assigned_to\` VARCHAR(255),
  \`guest_status\` VARCHAR(255),
  \`final_status\` VARCHAR(100),
  \`verified_by_user_id\` BIGINT UNSIGNED,
  \`verified_by_name\` VARCHAR(120),
  \`completed_at\` DATETIME,
  \`verified_at\` DATETIME,
  PRIMARY KEY (\`id\`),
  KEY \`idx_room\` (\`room_number\`),
  KEY \`idx_completed\` (\`completed_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for housekeeping_logs:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByRoom(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`housekeeping_logs\` WHERE \`room_number\` = ? ORDER BY \`completed_at\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`housekeeping_logs\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (HousekeepingLogs)()
