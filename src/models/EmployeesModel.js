const pool = require('../config/db')

class Employees {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`employees\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`user_id\` BIGINT UNSIGNED UNIQUE,
  \`employee_code\` VARCHAR(50) UNIQUE,
  \`first_name\` VARCHAR(120) NOT NULL,
  \`last_name\` VARCHAR(120),
  \`department_id\` INT UNSIGNED,
  \`designation_id\` INT UNSIGNED,
  \`date_of_joining\` DATE,
  \`date_of_leaving\` DATE,
  \`phone\` VARCHAR(30),
  \`emergency_contact\` VARCHAR(30),
  \`address\` TEXT,
  \`aadhaar_no\` VARCHAR(20),
  \`pan_no\` VARCHAR(20),
  \`bank_account\` VARCHAR(50),
  \`bank_ifsc\` VARCHAR(20),
  \`base_salary\` DECIMAL(12,2) DEFAULT 0,
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_user\` (\`user_id\`),
  KEY \`idx_employee_code\` (\`employee_code\`),
  KEY \`idx_department\` (\`department_id\`),
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET ON UPDATE CASCADE,
  FOREIGN KEY (\`designation_id\`) REFERENCES \`designations\`(\`id\`) ON DELETE SET ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for employees:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`employees\` ORDER BY \`first_name\`", args)
    return rows
  }

  async findByUserId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`employees\` WHERE \`user_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`employees\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (Employees)()
