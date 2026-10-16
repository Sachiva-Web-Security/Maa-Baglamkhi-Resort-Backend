const { pool, getConnection } = require('../utils/poolPromise')

class RoomCategories {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`room_categories\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(120) NOT NULL,
  \`slug\` VARCHAR(120) NOT NULL UNIQUE,
  \`description\` TEXT,
  \`max_adults\` INT DEFAULT 2,
  \`max_children\` INT DEFAULT 1,
  \`default_price\` DECIMAL(10,2) NOT NULL DEFAULT 0,
  \`size_sqft\` INT,
  \`bed_type\` VARCHAR(50),
  \`view_type\` VARCHAR(50),
  \`unit_label\` VARCHAR(40) DEFAULT \'Room\',
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`sort_order\` INT DEFAULT 0,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_slug\` (\`slug\`),
  KEY \`idx_active\` (\`is_active\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for room_categories:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAllActive(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_categories\` WHERE \`is_active\` = 1 ORDER BY \`sort_order\`, \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_categories\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`room_categories\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `room_categories`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"AC ROOM","slug":"ac-room","default_price":2000},{"name":"NON-AC ROOM","slug":"non-ac-room","default_price":1500},{"name":"DELUXE ROOM","slug":"deluxe-room","default_price":3000},{"name":"SUPER DELUXE ROOM","slug":"super-deluxe-room","default_price":4000},{"name":"SUITE ROOM","slug":"suite-room","default_price":5000},{"name":"DELUXE DORMITORY","slug":"deluxe-dormitory","default_price":800,"unit_label":"Bed"}]
      const cols = '0, 1, 2, 3, 4, 5'
      const placeholders = '?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `room_categories` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for room_categories:', err.message)
    }
  }
}

module.exports = new (RoomCategories)()
