const pool = require('../config/db')

class BookingSources {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`booking_sources\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(50) NOT NULL UNIQUE,
  \`type\` ENUM(\'direct\',\'walk_in\',\'ota\',\'corporate\',\'travel_agent\',\'gds\',\'social\',\'other\') DEFAULT \'direct\',
  \`is_active\` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for booking_sources:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`booking_sources\` ORDER BY \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`booking_sources\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `booking_sources`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"Walk-in","type":"walk_in"},{"name":"Online Direct","type":"direct"},{"name":"MakeMyTrip","type":"ota"},{"name":"Booking.com","type":"ota"},{"name":"Goibibo","type":"ota"},{"name":"Agoda","type":"ota"},{"name":"Corporate","type":"corporate"},{"name":"Travel Agent","type":"travel_agent"}]
      const cols = '0, 1, 2, 3, 4, 5, 6, 7'
      const placeholders = '?, ?, ?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `booking_sources` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for booking_sources:', err.message)
    }
  }
}

module.exports = new (BookingSources)()
