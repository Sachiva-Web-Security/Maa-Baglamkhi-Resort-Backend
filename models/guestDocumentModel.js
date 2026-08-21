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
  const rows = await runQuery("SHOW COLUMNS FROM guest_documents LIKE ?", [columnName]);
  if (!rows.length) {
    await runQuery(`ALTER TABLE guest_documents ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureIndex = async (indexName, createSql) => {
  const rows = await runQuery("SHOW INDEX FROM guest_documents WHERE Key_name = ?", [indexName]);
  if (!rows.length) {
    await runQuery(createSql);
  }
};

const ensureSchema = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS guest_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      mobile VARCHAR(50) DEFAULT '',
      guest_name VARCHAR(255) DEFAULT '',
      document_type VARCHAR(50) NOT NULL DEFAULT 'checkin_form',
      file_url VARCHAR(500) NOT NULL,
      terms_accepted TINYINT(1) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT NULL,
      uploaded_by VARCHAR(255) DEFAULT NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("booking_id", "INT NOT NULL AFTER id");
  await ensureColumn("mobile", "VARCHAR(50) DEFAULT '' AFTER booking_id");
  await ensureColumn("guest_name", "VARCHAR(255) DEFAULT '' AFTER mobile");
  await ensureColumn("document_type", "VARCHAR(50) NOT NULL DEFAULT 'checkin_form' AFTER guest_name");
  await ensureColumn("file_url", "VARCHAR(500) NOT NULL AFTER document_type");
  await ensureColumn("terms_accepted", "TINYINT(1) NOT NULL DEFAULT 0 AFTER file_url");
  await ensureColumn("notes", "TEXT DEFAULT NULL AFTER terms_accepted");
  await ensureColumn("uploaded_by", "VARCHAR(255) DEFAULT NULL AFTER notes");
  await ensureColumn("uploaded_at", "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER uploaded_by");

  await ensureIndex(
    "idx_guest_documents_booking_id",
    "CREATE INDEX idx_guest_documents_booking_id ON guest_documents (booking_id)",
  );
  await ensureIndex(
    "idx_guest_documents_mobile",
    "CREATE INDEX idx_guest_documents_mobile ON guest_documents (mobile)",
  );
  await ensureIndex(
    "idx_guest_documents_type",
    "CREATE INDEX idx_guest_documents_type ON guest_documents (document_type)",
  );
};

const createDocument = async (data) => {
  await ensureSchema();

  const result = await runQuery(
    `
      INSERT INTO guest_documents
      (booking_id, mobile, guest_name, document_type, file_url, terms_accepted, notes, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(data.bookingId),
      String(data.mobile || "").trim(),
      String(data.guestName || "").trim(),
      String(data.documentType || "checkin_form").trim(),
      String(data.fileUrl || "").trim(),
      data.termsAccepted ? 1 : 0,
      String(data.notes || "").trim() || null,
      String(data.uploadedBy || "").trim() || null,
    ],
  );

  return result;
};

const getDocumentsByBookingId = async (bookingId) => {
  await ensureSchema();

  return runQuery(
    `
      SELECT
        id,
        booking_id,
        mobile,
        guest_name,
        document_type,
        file_url,
        terms_accepted,
        notes,
        uploaded_by,
        uploaded_at
      FROM guest_documents
      WHERE booking_id = ?
      ORDER BY uploaded_at DESC, id DESC
    `,
    [Number(bookingId)],
  );
};

const getDocumentsByMobile = async (mobile) => {
  await ensureSchema();

  const normalizedMobile = String(mobile || "").trim();
  if (!normalizedMobile) {
    return [];
  }

  return runQuery(
    `
      SELECT
        gd.id,
        gd.booking_id,
        gd.mobile,
        gd.guest_name,
        gd.document_type,
        gd.file_url,
        gd.terms_accepted,
        gd.notes,
        gd.uploaded_by,
        gd.uploaded_at,
        g.booking_code
      FROM guest_documents gd
      LEFT JOIN guests g ON g.id = gd.booking_id
      WHERE gd.mobile = ?
      ORDER BY gd.uploaded_at DESC, gd.id DESC
    `,
    [normalizedMobile],
  );
};

module.exports = {
  createDocument,
  ensureSchema,
  getDocumentsByBookingId,
  getDocumentsByMobile,
};
