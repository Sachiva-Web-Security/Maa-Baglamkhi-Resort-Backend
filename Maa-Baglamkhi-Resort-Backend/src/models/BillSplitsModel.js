const { pool, getConnection } = require('../utils/poolPromise')

class BillSplits {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`bill_splits\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`bill_id\` BIGINT UNSIGNED NOT NULL,
  \`split_no\` INT NOT NULL,
  \`split_label\` VARCHAR(100),
  \`amount\` DECIMAL(12,2) NOT NULL,
  \`payment_method\` VARCHAR(50),
  \`paid_at\` DATETIME,
  PRIMARY KEY (\`id\`),
  KEY \`idx_bill\` (\`bill_id\`),
  FOREIGN KEY (\`bill_id\`) REFERENCES \`bills\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for bill_splits:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByBillId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bill_splits\` WHERE \`bill_id\` = ? ORDER BY \`split_no\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`bill_splits\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (BillSplits)()
