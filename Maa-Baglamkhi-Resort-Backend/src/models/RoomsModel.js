const { pool, getConnection } = require('../utils/poolPromise')

class Rooms {
  constructor() {
    this.pool = pool
  }

  async ensureSchema() {
    const conn = await getConnection()
    try {
      await conn.beginTransaction()

      await conn.query(`CREATE TABLE IF NOT EXISTS \`rooms\` (
            \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`room_number\` VARCHAR(50) NOT NULL,
  \`category_id\` INT UNSIGNED NOT NULL,
  \`floor\` VARCHAR(20),
  \`building\` VARCHAR(100),
  \`status\` ENUM(\'available\',\'occupied\',\'cleaning\',\'out_of_service\',\'reserved\') DEFAULT \'available\',
  \`current_booking_id\` INT UNSIGNED NULL,
  \`notes\` TEXT,
  \`created_at\` TIMESTAMP,
  \`updated_at\` TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_room_number\` (\`room_number\`),
  KEY \`idx_category\` (\`category_id\`),
  KEY \`idx_status\` (\`status\`),
  FOREIGN KEY (\`category_id\`) REFERENCES \`room_categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      console.error('Schema error for rooms:', err.message)
    } finally {
      conn.release()
    }
  }

  async findByStatus(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rooms\` WHERE \`status\` = ? ORDER BY \`room_number\`", args)
    return rows
  }

  async findAvailable(...args) {
    const [rows] = await this.pool.execute("SELECT r.*, rc.name as category_name FROM \`rooms\` r JOIN \`room_categories\` rc ON r.category_id = rc.id WHERE r.status = \'available\' AND r.category_id = ? ORDER BY r.room_number", args)
    return rows
  }

  async findById(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rooms\` WHERE \`id\` = ?", args)
    return rows
  }

  async findAll(...args) {
    const [rows] = await this.pool.execute("SELECT * FROM \`rooms\` ORDER BY \`created_at\` DESC", args)
    return rows
  }

  async getRoomSetup({ checkIn = null, checkOut = null } = {}) {
    const [categories] = await this.pool.execute(
      `SELECT id, name, default_price AS defaultPrice, unit_label AS unitLabel
       FROM \`room_categories\` ORDER BY id`
    );
    const [rooms] = await this.pool.execute(
      `SELECT id, category_id AS categoryId, room_number AS roomNumber,
              COALESCE(status, 'available') AS status,
              current_booking_id AS currentBookingId, notes
       FROM \`rooms\` ORDER BY CAST(room_number AS UNSIGNED), room_number`
    );

    let occupiedMap = {};
    if (checkIn && checkOut) {
      const [occupied] = await this.pool.execute(
        `SELECT r.room_number AS roomNumber, 'Occupied' AS status
         FROM \`booking_rooms\` br
         JOIN \`rooms\` r ON r.id = br.room_id
         JOIN \`bookings\` b ON b.id = br.booking_id
         WHERE LOWER(COALESCE(b.status, '')) NOT IN ('checked_out', 'cancelled')
           AND DATE(?) <= DATE(br.check_out)
           AND DATE(?) >= DATE(br.check_in)
         GROUP BY r.room_number`,
        [checkIn, checkOut]
      );
      occupiedMap = Object.fromEntries(
        occupied.map((row) => [String(row.roomNumber || "").trim(), row])
      );
    }

    return categories.map((category) => {
      const categoryRooms = rooms.filter(
        (room) => Number(room.categoryId) === Number(category.id)
      );
      return {
        ...category,
        rooms: categoryRooms.map((room) => room.roomNumber),
        roomDetails: categoryRooms.map((room) => {
          const occupied = occupiedMap[String(room.roomNumber || "").trim()];
          return occupied
            ? { ...room, status: occupied.status, guest: null, checkIn, checkOut }
            : { ...room, guest: null, checkIn: null, checkOut: null };
        }),
      };
    });
  }
}

module.exports = new (Rooms)()
