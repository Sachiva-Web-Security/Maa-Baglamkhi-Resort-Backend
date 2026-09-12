const pool = require('../config/db')

class SalaryPayments {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`salary_payments\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`employee_id\` BIGINT UNSIGNED NOT NULL,
  \`month\` DATE NOT NULL,
  \`basic_salary\` DECIMAL(12,2) NOT NULL,
  \`allowances\` DECIMAL(12,2) DEFAULT 0,
  \`deductions\` DECIMAL(12,2) DEFAULT 0,
  \`net_salary\` DECIMAL(12,2) NOT NULL,
  \`paid_amount\` DECIMAL(12,2) DEFAULT 0,
  \`payment_date\` DATE,
  \`payment_method\` VARCHAR(50),
  \`status\` ENUM(\'draft\',\'approved\',\'paid\',\'cancelled\') DEFAULT \'draft\',
  \`approved_by\` BIGINT UNSIGNED,
  \`paid_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_month\` (\`month\`),
  KEY \`idx_status\` (\`status\`),
  FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for salary_payments:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByEmployeeAndMonth(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`salary_payments\` WHERE \`employee_id\` = ? AND \`month\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`salary_payments\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`salary_payments\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (SalaryPayments)()
