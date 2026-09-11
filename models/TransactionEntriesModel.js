const pool = require('../config/db')

class TransactionEntries {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`transaction_entries\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`transaction_id\` BIGINT UNSIGNED NOT NULL,
  \`account_id\` INT UNSIGNED NOT NULL,
  \`entry_type\` ENUM(\'debit\',\'credit\') NOT NULL,
  \`amount\` DECIMAL(12,2) NOT NULL,
  \`description\` VARCHAR(255),
  PRIMARY KEY (\`id\`),
  KEY \`idx_transaction\` (\`transaction_id\`),
  KEY \`idx_account\` (\`account_id\`),
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for transaction_entries:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByTransactionId(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`transaction_entries\` WHERE \`transaction_id\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`transaction_entries\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (TransactionEntries)()
