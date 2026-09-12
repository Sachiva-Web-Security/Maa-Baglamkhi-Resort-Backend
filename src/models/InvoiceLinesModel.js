const { pool, getConnection } = require('../utils/poolPromise')

class InvoiceLines {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`invoice_lines\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`invoice_id\` BIGINT UNSIGNED NOT NULL,
  \`line_type\` ENUM(\'room_charge\',\'extra_charge\',\'food\',\'beverage\',\'service\',\'tax\',\'discount\',\'payment\',\'adjustment\',\'other\') DEFAULT \'other\',
  \`description\` VARCHAR(255) NOT NULL,
  \`reference_id\` BIGINT UNSIGNED,
  \`reference_type\` VARCHAR(50),
  \`quantity\` DECIMAL(10,3) DEFAULT 1,
  \`unit_price\` DECIMAL(10,2) DEFAULT 0,
  \`amount\` DECIMAL(12,2) NOT NULL,
  \`tax_percent\` DECIMAL(5,2) DEFAULT 0,
  \`tax_amount\` DECIMAL(10,2) DEFAULT 0,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_invoice\` (\`invoice_id\`),
  KEY \`idx_type\` (\`line_type\`),
  FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for invoice_lines:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByInvoiceId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`invoice_lines\` WHERE \`invoice_id\` = ? ORDER BY \`id\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`invoice_lines\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`invoice_lines\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (InvoiceLines)()
