const pool = require('../config/db')

class MenuCategories {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`menu_categories\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(120) NOT NULL,
  \`description\` TEXT,
  \`sort_order\` INT DEFAULT 0,
  \`is_active\` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (\`id\`),
  KEY \`idx_active\` (\`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for menu_categories:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAllActive(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`menu_categories\` WHERE \`is_active\` = 1 ORDER BY \`sort_order\`, \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`menu_categories\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `menu_categories`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"Starters","sort_order":1},{"name":"Main Course","sort_order":2},{"name":"Breads","sort_order":3},{"name":"Rice & Biryani","sort_order":4},{"name":"Desserts","sort_order":5},{"name":"Beverages","sort_order":6}]
      const cols = '0, 1, 2, 3, 4, 5'
      const placeholders = '?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `menu_categories` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for menu_categories:', err.message)
    }
  }
}

module.exports = new (MenuCategories)()
