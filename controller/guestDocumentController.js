const db = require("../config/db");
const GuestIdentificationsModel = require("../models/GuestIdentificationsModel");

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

const normalizeDocumentType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  const allowedTypes = ["checkin_form", "guest_photo", "signature", "id_proof"];
  return allowedTypes.includes(normalized) ? normalized : "checkin_form";
};

const parseBoolean = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

exports.uploadByBooking = async (req, res) => {
  const bookingId = Number(req.params.bookingId);

  if (!bookingId) {
    return res.status(400).json({ message: "Valid booking id is required" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Document image is required" });
  }

  try {
    const guestRows = await runQuery(
      "SELECT id, mobile, guest_name, booking_code FROM guests WHERE id = ? LIMIT 1",
      [bookingId],
    );
    const guest = guestRows[0];

    if (!guest) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const result = await db.query(
      `INSERT INTO guest_identifications (booking_id, guest_id, document_type, file_url, notes, uploaded_by, is_accepted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        bookingId,
        guest.id,
        normalizeDocumentType(req.body.documentType),
        fileUrl,
        req.body.notes || null,
        req.body.uploadedBy || null,
        parseBoolean(req.body.termsAccepted) ? 1 : 0,
      ]
    );
    const insertId = result[0]?.insertId || result.insertId;

    const documents = await GuestIdentificationsModel.findAll().then(rows => rows.filter(row => Number(row.booking_id) === bookingId));
    const document = documents.find((row) => Number(row.id) === Number(insertId)) || null;

    res.status(201).json({
      message: "Guest document uploaded successfully",
      bookingId,
      bookingCode: guest.booking_code || "",
      document,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Guest document upload failed:", error);
    }
    res.status(500).json({ message: "Guest document upload failed", error: error.message });
  }
};

exports.listByBooking = async (req, res) => {
  const bookingId = Number(req.params.bookingId);

  if (!bookingId) {
    return res.status(400).json({ message: "Valid booking id is required" });
  }

  try {
    const documents = await GuestIdentificationsModel.findAll().then(rows => rows.filter(row => Number(row.booking_id) === bookingId));
    res.json(documents);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Guest document fetch failed:", error);
    }
    res.status(500).json({ message: "Guest document fetch failed", error: error.message });
  }
};
