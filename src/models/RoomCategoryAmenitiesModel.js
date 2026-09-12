const pool = require('../config/db')

class RoomCategoryAmenities {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`room_category_amenities\` (
            \`category_id\` INT UNSIGNED NOT NULL,
  \`amenity_id\` INT UNSIGNED NOT NULL,
  FOREIGN KEY (\`category_id\`) REFERENCES \`room_categories\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for room_category_amenities:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByCategory(...args) {
    const [rows] = await this.pool.execute("SELECT a.* FROM \`amenities\` a JOIN \`room_category_amenities\` rca ON a.id = rca.amenity_id WHERE rca.category_id = ?", args)
    return rows
  }
}

module.exports = new (RoomCategoryAmenities)()
