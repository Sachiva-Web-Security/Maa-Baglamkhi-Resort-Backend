const { pool, getConnection } = require('../utils/poolPromise')

class RolePermissions {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`role_permissions\` (
            \`role_id\` INT UNSIGNED NOT NULL,
  \`permission_id\` INT UNSIGNED NOT NULL,
  FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for role_permissions:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByRoleId(...args) {
    const [rows] = await this.pool.execute("SELECT p.* FROM \`permissions\` p JOIN \`role_permissions\` rp ON p.id = rp.permission_id WHERE rp.role_id = ?", args)
    return rows
  }
}

module.exports = new (RolePermissions)()
