const pool = require('../config/db')

class Amenities {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`amenities\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(100) NOT NULL UNIQUE,
  \`icon\` VARCHAR(100),
  \`category\` VARCHAR(50),
  \`description\` TEXT,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for amenities:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`amenities\` ORDER BY \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`amenities\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `amenities`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"WiFi","category":"Technology"},{"name":"Air Conditioning","category":"Comfort"},{"name":"Swimming Pool","category":"Recreation"},{"name":"Spa","category":"Wellness"},{"name":"Gym","category":"Fitness"},{"name":"Room Service","category":"Service"},{"name":"Laundry","category":"Service"},{"name":"Parking","category":"Facility"},{"name":"Restaurant","category":"Dining"},{"name":"Bar","category":"Dining"}]
      const cols = '0, 1, 2, 3, 4, 5, 6, 7, 8, 9'
      const placeholders = '?, ?, ?, ?, ?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `amenities` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for amenities:', err.message)
    }
  }
}

module.exports = new (Amenities)()
