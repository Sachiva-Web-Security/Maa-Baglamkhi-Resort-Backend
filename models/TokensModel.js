const pool = require('../config/db')

class Tokens {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`tokens\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`token_code\` VARCHAR(40) NOT NULL UNIQUE,
  \`table_id\` INT UNSIGNED,
  \`table_number\` VARCHAR(50),
  \`waiter_id\` BIGINT UNSIGNED,
  \`waiter_name\` VARCHAR(191),
  \`status\` ENUM(\'active\',\'completed\',\'cancelled\',\'expired\') DEFAULT \'active\',
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_code\` (\`token_code\`),
  KEY \`idx_status\` (\`status\`),
  KEY \`idx_table\` (\`table_number\`),
  FOREIGN KEY (\`table_id\`) REFERENCES \`restaurant_tables\`(\`id\`) ON DELETE SET ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for tokens:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByCode(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` WHERE \`token_code\` = ?", args)
    return rows
  }

  async findActiveByTable(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` WHERE \`table_number\` = ? AND \`status\` = \'active\'", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`tokens\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
  async createToken(tokenData = {}) {
    const [result] = await this.pool.execute(
      `INSERT INTO tokens (token_code, table_number, waiter_name, status)
       VALUES (?, ?, ?, ?)`,
      [
        tokenData.tokenCode || null,
        tokenData.tableNumber || tokenData.table_number || null,
        tokenData.waiterName || tokenData.waiter || null,
        tokenData.status || 'active',
      ]
    )
    return { insertId: result.insertId }
  }

  async addTokenItem(itemData = {}) {
    const [result] = await this.pool.execute(
      `INSERT INTO token_items (token_id, item_name, qty, rate)
       VALUES (?, ?, ?, ?)`,
      [
        itemData.tokenId || itemData.token_id || null,
        itemData.name || itemData.item_name || 'Item',
        itemData.qty || itemData.quantity || 1,
        itemData.price || itemData.rate || 0,
      ]
    )
    return { insertId: result.insertId }
  }

  async getTokenItems(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM `token_items` WHERE `token_id` = ?", args)
    return rows
  }

  async updateTokenItem(id, updates = {}) {
    const setParts = []
    const values = []
    if (updates.qty !== undefined) { setParts.push('qty = ?'); values.push(updates.qty) }
    if (updates.rate !== undefined) { setParts.push('rate = ?'); values.push(updates.rate) }
    if (!setParts.length) return
    values.push(id)
    await this.pool.execute(`UPDATE token_items SET ${setParts.join(', ')} WHERE id = ?`, values)
  }

  async deleteTokenItem(...args) {
    await this.pool.execute("DELETE FROM `token_items` WHERE `id` = ?", args)
  }
}

module.exports = new (Tokens)()
