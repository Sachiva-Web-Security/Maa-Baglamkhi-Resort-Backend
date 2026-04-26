const db = require("../config/db"); // adjust if your db path differs
const dbPromise = db.promise();

const BanquetInquiryModel = {
  async createTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS banquet_inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        event_date DATE NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        guest_count INT NOT NULL DEFAULT 0,
        preferred_hall_id INT DEFAULT NULL,
        start_time TIME DEFAULT NULL,
        end_time TIME DEFAULT NULL,
        message TEXT DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'New',
        ip_address VARCHAR(100) DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    return dbPromise.query(query);
  },

  async createInquiry(data) {
    const query = `
      INSERT INTO banquet_inquiries
      (name, email, phone, event_date, event_type, guest_count,
       preferred_hall_id, start_time, end_time, message, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.name,
      data.email,
      data.phone,
      data.eventDate,
      data.eventType,
      data.guestCount,
      data.preferredHallId,
      data.startTime,
      data.endTime,
      data.message,
      data.ipAddress,
      data.userAgent,
    ];

    return dbPromise.query(query, values);
  },

  async getAllInquiries() {
    const [rows] = await dbPromise.query(`
      SELECT
        id,
        name,
        email,
        phone,
        event_date AS eventDate,
        event_type AS eventType,
        guest_count AS guestCount,
        preferred_hall_id AS preferredHallId,
        start_time AS startTime,
        end_time AS endTime,
        message,
        status,
        ip_address AS ipAddress,
        user_agent AS userAgent,
        created_at AS createdAt
      FROM banquet_inquiries
      ORDER BY id DESC
    `);

    return rows;
  },
};

module.exports = BanquetInquiryModel;
