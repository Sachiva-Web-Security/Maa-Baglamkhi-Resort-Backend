const pool = require('../config/db')

class GuestProfiles {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`guest_profiles\` (
            \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`first_name\` VARCHAR(120) NOT NULL,
  \`last_name\` VARCHAR(120),
  \`email\` VARCHAR(191),
  \`phone\` VARCHAR(30) NOT NULL,
  \`alternate_phone\` VARCHAR(30),
  \`date_of_birth\` DATE,
  \`gender\` ENUM(\'male\',\'female\',\'other\',\'prefer_not_to_say\'),
  \`nationality\` VARCHAR(100) DEFAULT \'Indian\',
  \`id_type\` ENUM(\'aadhaar\',\'passport\',\'driving_license\',\'voter_id\',\'other\'),
  \`id_number\` VARCHAR(100),
  \`address_line1\` VARCHAR(255),
  \`address_line2\` VARCHAR(255),
  \`city\` VARCHAR(100),
  \`state\` VARCHAR(100),
  \`country\` VARCHAR(100),
  \`pincode\` VARCHAR(20),
  \`preferences\` JSON,
  \`is_vip\` TINYINT(1) DEFAULT 0,
  \`total_stays\` INT DEFAULT 0,
  \`total_spend\` DECIMAL(14,2) DEFAULT 0,
  \`last_stay_date\` DATE,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_phone\` (\`phone\`),
  KEY \`idx_email\` (\`email\`),
  KEY \`idx_vip\` (\`is_vip\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for guest_profiles:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByPhone(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_profiles\` WHERE \`phone\` = ?", args)
    return rows
  }

  async findByEmail(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_profiles\` WHERE \`email\` = ?", args)
    return rows
  }

  async findVIP(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_profiles\` WHERE \`is_vip\` = 1 ORDER BY \`last_stay_date\` DESC", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_profiles\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`guest_profiles\` ORDER BY \`created_at\` DESC", args)
    return rows
  }
}

module.exports = new (GuestProfiles)()
