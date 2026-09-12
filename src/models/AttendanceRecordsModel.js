const pool = require('../config/db')

class AttendanceRecords {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`attendance_records\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`employee_id\` BIGINT UNSIGNED NOT NULL,
  \`date\` DATE NOT NULL,
  \`check_in\` TIME,
  \`check_out\` TIME,
  \`status\` ENUM(\'present\',\'absent\',\'late\',\'half_day\',\'on_leave\',\'holiday\',\'week_off\') DEFAULT \'present\',
  \`leave_type\` ENUM(\'casual\',\'sick\',\'earned\',\'maternity\',\'paternity\',\'unpaid\',\'other\'),
  \`notes\` TEXT,
  \`approved_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_date\` (\`date\`),
  KEY \`idx_status\` (\`status\`),
  FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for attendance_records:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByEmployeeAndMonth(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`attendance_records\` WHERE \`employee_id\` = ? AND MONTH(\`date\`) = ? AND YEAR(\`date\`) = ? ORDER BY \`date\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`attendance_records\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`attendance_records\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (AttendanceRecords)()
