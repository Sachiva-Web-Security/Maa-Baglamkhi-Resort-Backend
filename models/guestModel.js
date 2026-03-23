const crypto = require("crypto");
const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS guests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_code VARCHAR(40) NOT NULL UNIQUE,
      mobile VARCHAR(50) DEFAULT '',
      guest_name VARCHAR(255) DEFAULT '',
      guest_email VARCHAR(255) DEFAULT '',
      check_in DATE DEFAULT NULL,
      check_out DATE DEFAULT NULL,
      arrival VARCHAR(20) DEFAULT NULL,
      departure VARCHAR(20) DEFAULT NULL,
      booking_status VARCHAR(50) DEFAULT 'Confirmed'
    )
  `);

  const bookingCodeColumn = await runQuery("SHOW COLUMNS FROM guests LIKE 'booking_code'");
  if (!bookingCodeColumn.length) {
    await runQuery("ALTER TABLE guests ADD COLUMN booking_code VARCHAR(40) NULL UNIQUE AFTER id");
  }

  const missingCodes = await runQuery(
    "SELECT id FROM guests WHERE booking_code IS NULL OR booking_code = '' ORDER BY id",
  );

  for (const row of missingCodes) {
    const bookingCode = `BK-${String(row.id).padStart(6, "0")}`;
    await runQuery("UPDATE guests SET booking_code = ? WHERE id = ?", [bookingCode, row.id]);
  }
};

const generateBookingCode = () => {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `BK-${datePart}-${randomPart}`;
};

const createGuest = async (data, callback) => {
  try {
    await ensureSchema();

    const bookingKey = [
      String(data.mobile || "").trim(),
      String(data.guestName || "").trim().toLowerCase(),
      String(data.checkIn || "").trim(),
      String(data.checkOut || "").trim(),
    ].join("|");

    const existingRows = await runQuery(
      `
        SELECT id, booking_code
        FROM guests
        WHERE CONCAT(
          TRIM(IFNULL(mobile, '')), '|',
          LOWER(TRIM(IFNULL(guest_name, ''))), '|',
          TRIM(IFNULL(check_in, '')), '|',
          TRIM(IFNULL(check_out, ''))
        ) = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [bookingKey],
    );

    if (existingRows.length) {
      callback(null, {
        insertId: existingRows[0].id,
        bookingCode: existingRows[0].booking_code,
        reused: true,
      });
      return;
    }

    const bookingCode = generateBookingCode();
    const sql = `
      INSERT INTO guests
      (booking_code, mobile, guest_name, guest_email, check_in, check_out, arrival, departure, booking_status)
      VALUES (?,?,?,?,?,?,?,?,?)
    `;

    db.query(
      sql,
      [
        bookingCode,
        data.mobile,
        data.guestName,
        data.guestEmail,
        data.checkIn,
        data.checkOut,
        data.arrival,
        data.departure,
        data.bookingStatus,
      ],
      (error, result) => {
        if (error) return callback(error);
        callback(null, { ...result, bookingCode });
      },
    );
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  createGuest,
  ensureSchema,
};
