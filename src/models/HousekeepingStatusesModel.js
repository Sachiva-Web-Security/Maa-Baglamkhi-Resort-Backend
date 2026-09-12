const { pool, getConnection } = require('../utils/poolPromise')

class HousekeepingStatuses {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`housekeeping_statuses\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(50) NOT NULL UNIQUE,
  \`display_name\` VARCHAR(100) NOT NULL,
  \`color\` VARCHAR(30),
  \`sort_order\` INT DEFAULT 0,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for housekeeping_statuses:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`housekeeping_statuses\` ORDER BY \`sort_order\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`housekeeping_statuses\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `housekeeping_statuses`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"vacant_dirty","display_name":"Vacant Dirty","color":"#F59E0B","sort_order":1},{"name":"vacant_clean","display_name":"Vacant Clean","color":"#10B981","sort_order":2},{"name":"cleaning_in_progress","display_name":"Cleaning In Progress","color":"#3B82F6","sort_order":3},{"name":"occupied_dirty","display_name":"Occupied Dirty","color":"#EF4444","sort_order":4},{"name":"occupied_clean","display_name":"Occupied Clean","color":"#10B981","sort_order":5},{"name":"out_of_service","display_name":"Out of Service","color":"#6B7280","sort_order":6},{"name":"reserved","display_name":"Reserved","color":"#8B5CF6","sort_order":7}]
      const cols = '0, 1, 2, 3, 4, 5, 6'
      const placeholders = '?, ?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `housekeeping_statuses` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for housekeeping_statuses:', err.message)
    }
  }
}

module.exports = new (HousekeepingStatuses)()
