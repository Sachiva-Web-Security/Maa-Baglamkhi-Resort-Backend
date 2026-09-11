const pool = require('../config/db')

class ResortProfiles {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`resort_profiles\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(191) NOT NULL,
  \`tagline\` VARCHAR(255),
  \`description\` TEXT,
  \`address_line1\` VARCHAR(255),
  \`address_line2\` VARCHAR(255),
  \`city\` VARCHAR(100),
  \`state\` VARCHAR(100),
  \`country\` VARCHAR(100) DEFAULT \'India\',
  \`pincode\` VARCHAR(20),
  \`phone\` VARCHAR(30),
  \`email\` VARCHAR(191),
  \`website\` VARCHAR(255),
  \`gstin\` VARCHAR(50),
  \`check_in_time\` TIME DEFAULT \'14:00:00\',
  \`check_out_time\` TIME DEFAULT \'11:00:00\',
  \`logo_url\` VARCHAR(500),
  \`cover_image_url\` VARCHAR(500),
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for resort_profiles:', err.message)
    } finally {
      conn.release()
    }
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`resort_profiles\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`resort_profiles\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `resort_profiles`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"Maa Baglamukhi Resort","country":"India"}]
      const cols = '0'
      const placeholders = '?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `resort_profiles` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for resort_profiles:', err.message)
    }
  }
}

module.exports = new (ResortProfiles)()
