const { pool, getConnection } = require('../utils/poolPromise')

class Transactions {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`transactions\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`transaction_no\` VARCHAR(80) NOT NULL UNIQUE,
  \`transaction_date\` DATE NOT NULL,
  \`description\` VARCHAR(255) NOT NULL,
  \`reference_type\` VARCHAR(50),
  \`reference_id\` BIGINT UNSIGNED,
  \`created_by\` BIGINT UNSIGNED,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_date\` (\`transaction_date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for transactions:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByNo(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`transactions\` WHERE \`transaction_no\` = ?", args)
    return rows
  }

  async findByDateRange(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`transactions\` WHERE \`transaction_date\` BETWEEN ? AND ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`transactions\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`transactions\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (Transactions)()
