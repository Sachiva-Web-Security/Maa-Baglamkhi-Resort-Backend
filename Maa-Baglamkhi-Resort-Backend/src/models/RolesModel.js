const { pool, getConnection } = require('../utils/poolPromise')

class Roles {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`roles\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(50) NOT NULL UNIQUE,
  \`display_name\` VARCHAR(100) NOT NULL,
  \`description\` TEXT,
  \`is_system\` TINYINT(1) DEFAULT 0,
  \`created_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for roles:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByName(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`roles\` WHERE \`name\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`roles\` ORDER BY \`id\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`roles\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `roles`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"admin","display_name":"Administrator","is_system":1},{"name":"manager","display_name":"Manager","is_system":1},{"name":"front_desk","display_name":"Front Desk","is_system":1},{"name":"staff","display_name":"Staff","is_system":1},{"name":"housekeeping","display_name":"Housekeeping","is_system":1},{"name":"kitchen","display_name":"Kitchen","is_system":1},{"name":"accountant","display_name":"Accountant","is_system":1}]
      const cols = '0, 1, 2, 3, 4, 5, 6'
      const placeholders = '?, ?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `roles` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for roles:', err.message)
    }
  }
}

module.exports = new (Roles)()
