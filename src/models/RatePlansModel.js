const { pool, getConnection } = require('../utils/poolPromise')

class RatePlans {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`rate_plans\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`code\` VARCHAR(20) NOT NULL UNIQUE,
  \`name\` VARCHAR(100) NOT NULL,
  \`description\` TEXT,
  \`includes_breakfast\` TINYINT(1) DEFAULT 0,
  \`includes_lunch\` TINYINT(1) DEFAULT 0,
  \`includes_dinner\` TINYINT(1) DEFAULT 0,
  \`is_active\` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for rate_plans:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rate_plans\` ORDER BY \`id\`", args)
    return rows
  }

  async findByCode(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rate_plans\` WHERE \`code\` = ?", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rate_plans\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `rate_plans`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"code":"BAR","name":"Best Available Rate","is_active":1},{"code":"EP","name":"European Plan (Room Only)","is_active":1},{"code":"CP","name":"Continental Plan (Breakfast)","is_active":1,"includes_breakfast":1},{"code":"MAP","name":"Modified American Plan","is_active":1,"includes_breakfast":1,"includes_dinner":1},{"code":"AP","name":"American Plan (All Meals)","is_active":1,"includes_breakfast":1,"includes_lunch":1,"includes_dinner":1}]
      const cols = '0, 1, 2, 3, 4'
      const placeholders = '?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `rate_plans` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for rate_plans:', err.message)
    }
  }
}

module.exports = new (RatePlans)()
