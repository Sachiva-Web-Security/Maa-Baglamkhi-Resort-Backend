// models/guestModel.js
// v4: the legacy `guests` table was replaced by `bookings` + `guest_profiles`.
// Guest creation now writes a booking plus a primary guest profile. This module
// keeps the original callback-style `createGuest(data, callback)` contract.
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
  // Schema is owned by the v4 models (BookingsModel / GuestProfilesModel).
  // Nothing to bootstrap here anymore.
};

const generateBookingCode = () => {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `BK-${datePart}-${randomPart}`;
};

const STATUS_MAP = {
  inquiry: "inquiry",
  confirmed: "confirmed",
  reserved: "reserved",
  "checked in": "checked_in",
  checked_in: "checked_in",
  "checked out": "checked_out",
  checked_out: "checked_out",
  cancelled: "cancelled",
  canceled: "cancelled",
  "no show": "no_show",
  no_show: "no_show",
};

const normalizeStatus = (status) => {
  const key = String(status || "").trim().toLowerCase();
  return STATUS_MAP[key] || "confirmed";
};

const createGuest = async (data, callback) => {
  try {
    const status = normalizeStatus(data.bookingStatus);
    const fullName = String(data.guestName || "").trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || null;

    let attempt = 0;
    while (attempt < 5) {
      const bookingCode = generateBookingCode();
      try {
        const insertResult = await runQuery(
          `INSERT INTO bookings
             (booking_code, status, check_in, check_out, adults, children, total_rooms, total_guests)
           VALUES (?, ?, ?, ?, 1, 0, 1, 1)`,
          [bookingCode, status, data.checkIn || null, data.checkOut || null],
        );

        const bookingId = insertResult.insertId;

        const guestResult = await runQuery(
          `INSERT INTO guest_profiles (first_name, last_name, email, phone)
           VALUES (?, ?, ?, ?)`,
          [firstName || "Guest", lastName, data.guestEmail || null, data.mobile || null],
        );

        await runQuery(
          `INSERT INTO booking_guests (booking_id, guest_profile_id, is_primary, first_name, last_name)
           VALUES (?, ?, 1, ?, ?)`,
          [bookingId, guestResult.insertId, firstName || "Guest", lastName],
        );

        callback(null, { insertId: bookingId, bookingCode });
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
