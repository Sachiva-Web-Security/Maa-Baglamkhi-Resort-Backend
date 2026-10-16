const { pool, getConnection } = require('../utils/poolPromise')

class MaintenanceRequests {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`maintenance_requests\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`room_id\` INT UNSIGNED,
  \`room_number\` VARCHAR(50),
  \`request_type\` VARCHAR(100) NOT NULL,
  \`description\` TEXT,
  \`priority\` ENUM(\'urgent\',\'high\',\'normal\',\'low\') DEFAULT \'normal\',
  \`status\` ENUM(\'open\',\'in_progress\',\'resolved\',\'cancelled\') DEFAULT \'open\',
  \`assigned_to\` BIGINT UNSIGNED,
  \`reported_by\` BIGINT UNSIGNED,
  \`resolved_at\` DATETIME,
  \`cost\` DECIMAL(10,2) DEFAULT 0,
  \`notes\` TEXT,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_room\` (\`room_number\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_priority\` (\`priority\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for maintenance_requests:', err.message)
    } finally {
      conn.release()
    }
  }

  async findOpen(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`maintenance_requests\` WHERE \`status\` IN (\'open\',\'in_progress\') ORDER BY FIELD(\`priority\`,\'urgent\',\'high\',\'normal\',\'low\'), \`created_at\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`maintenance_requests\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`maintenance_requests\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (MaintenanceRequests)()
