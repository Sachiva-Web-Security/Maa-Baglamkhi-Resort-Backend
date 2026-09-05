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

const ensureColumn = async (columnName, definition) => {
  const rows = await runQuery("SHOW COLUMNS FROM guests LIKE ?", [columnName]);
  if (!rows.length) {
    await runQuery(`ALTER TABLE guests ADD COLUMN ${columnName} ${definition}`);
  }
};

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
      booking_status VARCHAR(50) DEFAULT 'Confirmed',
      cancel_reason TEXT DEFAULT NULL
    )
  `);

  await ensureColumn("booking_code", "VARCHAR(40) NULL UNIQUE AFTER id");
  await ensureColumn("guest_name", "VARCHAR(255) DEFAULT '' AFTER mobile");
  await ensureColumn("guest_email", "VARCHAR(255) DEFAULT '' AFTER guest_name");
  await ensureColumn("check_in", "DATE DEFAULT NULL AFTER guest_email");
  await ensureColumn("check_out", "DATE DEFAULT NULL AFTER check_in");
  await ensureColumn("arrival", "VARCHAR(20) DEFAULT NULL AFTER check_out");
  await ensureColumn("departure", "VARCHAR(20) DEFAULT NULL AFTER arrival");
  await ensureColumn("booking_status", "VARCHAR(50) DEFAULT 'Confirmed' AFTER departure");
  await ensureColumn("cancel_reason", "TEXT DEFAULT NULL AFTER booking_status");
  await ensureColumn("booked_by", "VARCHAR(255) DEFAULT '' AFTER cancel_reason");

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
    const normalizedStatus = ["cancelled", "checked in", "checked out"].includes(
      String(data.bookingStatus || "").trim().toLowerCase(),
    )
      ? data.bookingStatus
      : "Confirmed";

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

    let attempt = 0;
    while (attempt < 5) {
      const bookingCode = generateBookingCode();
      const sql = `
        INSERT INTO guests
        (booking_code, mobile, guest_name, guest_email, check_in, check_out, arrival, departure, booking_status)
        VALUES (?,?,?,?,?,?,?,?,?)
      `;

      try {
        const result = await new Promise((resolve, reject) => {
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
              normalizedStatus,
            ],
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            },
          );
        });
        callback(null, { ...result, bookingCode });
        return;
      } catch (error) {
        // Retry on UNIQUE constraint collision for booking_code
        if (error.code === "ER_DUP_ENTRY" && attempt < 4) {
          attempt++;
          continue;
        }
        callback(error);
        return;
      }
    }
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  createGuest,
  ensureSchema,
};
