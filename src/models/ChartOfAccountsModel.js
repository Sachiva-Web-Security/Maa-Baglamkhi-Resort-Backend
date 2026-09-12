const pool = require('../config/db')

class ChartOfAccounts {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`chart_of_accounts\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`code\` VARCHAR(20) NOT NULL UNIQUE,
  \`name\` VARCHAR(191) NOT NULL,
  \`type\` ENUM(\'asset\',\'liability\',\'equity\',\'revenue\',\'expense\') NOT NULL,
  \`parent_id\` INT UNSIGNED,
  \`is_active\` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (\`id\`),
  KEY \`idx_code\` (\`code\`),
  KEY \`idx_type\` (\`type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for chart_of_accounts:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByType(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`chart_of_accounts\` WHERE \`type\` = ? ORDER BY \`code\`", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`chart_of_accounts\` ORDER BY \`code\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`chart_of_accounts\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `chart_of_accounts`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"code":"1000","name":"Cash in Hand","type":"asset"},{"code":"1010","name":"Bank Account","type":"asset"},{"code":"2000","name":"Accounts Payable","type":"liability"},{"code":"3000","name":"Owner's Equity","type":"equity"},{"code":"4000","name":"Room Revenue","type":"revenue"},{"code":"4010","name":"Restaurant Revenue","type":"revenue"},{"code":"4020","name":"Banquet Revenue","type":"revenue"},{"code":"5000","name":"Cost of Goods Sold","type":"expense"},{"code":"5010","name":"Staff Salaries","type":"expense"},{"code":"5020","name":"Utilities","type":"expense"}]
      const cols = '0, 1, 2, 3, 4, 5, 6, 7, 8, 9'
      const placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `chart_of_accounts` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for chart_of_accounts:', err.message)
    }
  }
}

module.exports = new (ChartOfAccounts)()
