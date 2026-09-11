const pool = require('../config/db')

class Permissions {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`permissions\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`module\` VARCHAR(50) NOT NULL,
  \`action\` VARCHAR(50) NOT NULL,
  \`description\` VARCHAR(255),
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for permissions:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`permissions\` ORDER BY \`module\`, \`action\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`permissions\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `permissions`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"module":"dashboard","action":"read"},{"module":"bookings","action":"create"},{"module":"bookings","action":"read"},{"module":"bookings","action":"update"},{"module":"bookings","action":"delete"},{"module":"restaurant","action":"create"},{"module":"restaurant","action":"read"},{"module":"kitchen","action":"read"},{"module":"kitchen","action":"update"},{"module":"housekeeping","action":"read"},{"module":"housekeeping","action":"update"},{"module":"inventory","action":"read"},{"module":"inventory","action":"update"},{"module":"accounts","action":"read"},{"module":"accounts","action":"update"},{"module":"reports","action":"read"},{"module":"users","action":"read"},{"module":"users","action":"update"},{"module":"settings","action":"update"}]
      const cols = '0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18'
      const placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `permissions` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for permissions:', err.message)
    }
  }
}

module.exports = new (Permissions)()
