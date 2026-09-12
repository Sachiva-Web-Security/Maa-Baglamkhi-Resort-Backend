const { pool, getConnection } = require('../utils/poolPromise')

class InventoryVendors {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`inventory_vendors\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(191) NOT NULL,
  \`contact_person\` VARCHAR(191),
  \`phone\` VARCHAR(30),
  \`email\` VARCHAR(191),
  \`address\` TEXT,
  \`gstin\` VARCHAR(50),
  \`category\` VARCHAR(100),
  \`is_active\` TINYINT(1) DEFAULT 1,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_name\` (\`name\`),
  KEY \`idx_gstin\` (\`gstin\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for inventory_vendors:', err.message)
    } finally {
      conn.release()
    }
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_vendors\` ORDER BY \`name\`", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`inventory_vendors\` WHERE \`id\` = ?", args)
    return rows
  }
}

module.exports = new (InventoryVendors)()
