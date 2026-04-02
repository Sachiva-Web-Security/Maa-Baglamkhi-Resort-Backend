const db = require("../config/db");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS reference_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guest_id INT NOT NULL,
      guest_type VARCHAR(100) DEFAULT NULL,
      guest_notes TEXT DEFAULT NULL,
      internal_notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_reference_notes_guest_id (guest_id)
    )
  `);
};

const createReference = async (data, callback) => {
  const guestId = Number(data.guest_id || data.booking_id);

  if (!guestId) {
    callback(new Error("Guest ID is required"));
    return;
  }

  try {
    await ensureSchema();

    const sql = `
      INSERT INTO reference_notes
      (guest_id, guest_type, guest_notes, internal_notes)
      VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE
        guest_type = VALUES(guest_type),
        guest_notes = VALUES(guest_notes),
        internal_notes = VALUES(internal_notes)
    `;

    db.query(
      sql,
      [
        guestId,
        data.guestType || null,
        data.guestNotes || null,
        data.internalNotes || null,
      ],
      callback,
    );
  } catch (error) {
    callback(error);
  }
};

module.exports = {
  createReference,
  ensureSchema,
};
