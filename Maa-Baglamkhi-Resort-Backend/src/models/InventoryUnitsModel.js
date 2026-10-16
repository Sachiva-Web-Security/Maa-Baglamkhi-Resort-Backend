const { pool, getConnection } = require('../utils/poolPromise')

class InventoryUnits {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_units\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(50) NOT NULL UNIQUE,
  \`abbreviation\` VARCHAR(20) NOT NULL,
  \`base_unit_id\` INT UNSIGNED,
  \`conversion_factor\` DECIMAL(10,4) DEFAULT 1,
  PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_units:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_units\` ORDER BY \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_units\` WHERE \`id\` = ?", args)
    return rows
  }
  async seed() {
    try {
      const [existing] = await this.pool.execute('SELECT COUNT(*) as cnt FROM `inventory_units`')
      if (existing[0] && existing[0].cnt > 0) return
      const rows = [{"name":"Piece","abbreviation":"pcs"},{"name":"Kilogram","abbreviation":"kg"},{"name":"Gram","abbreviation":"g"},{"name":"Liter","abbreviation":"L"},{"name":"Milliliter","abbreviation":"ml"},{"name":"Dozen","abbreviation":"dz"},{"name":"Packet","abbreviation":"pkt"},{"name":"Box","abbreviation":"box"}]
      const cols = '0, 1, 2, 3, 4, 5, 6, 7'
      const placeholders = '?, ?, ?, ?, ?, ?, ?, ?'
      for (const row of rows) {
        const vals = Object.values(row)
        await this.pool.execute('INSERT INTO `inventory_units` (' + cols + ') VALUES (' + placeholders + ')', vals)
      }
    } catch (err) {
      console.error('Seed error for inventory_units:', err.message)
    }
  }
}

module.exports = new (InventoryUnits)()
