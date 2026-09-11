const pool = require('../config/db')

class PaymentMethods {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`payment_methods\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(50) NOT NULL UNIQUE,
  \`code\` VARCHAR(30) NOT NULL UNIQUE,
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`icon\` VARCHAR(100),
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for payment_methods:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`payment_methods\` ORDER BY \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`payment_methods\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `payment_methods`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"Cash","code":"cash"},{"name":"Credit Card","code":"card"},{"name":"Debit Card","code":"card"},{"name":"UPI","code":"upi"},{"name":"Net Banking","code":"net_banking"},{"name":"Credit (Hotel)","code":"credit"}]
      const cols = '0, 1, 2, 3, 4, 5'
      const placeholders = '?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `payment_methods` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for payment_methods:', err.message)
    }
  }
}

module.exports = new (PaymentMethods)()
