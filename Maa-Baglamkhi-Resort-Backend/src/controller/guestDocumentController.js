const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const GuestIdentificationsModel = require("../models/GuestIdentificationsModel");


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
    const [guestRows] = await db.query(
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

exports.deleteByBooking = async (req, res) => {
  const bookingId = Number(req.params.bookingId);
  const documentId = Number(req.params.documentId);

  if (!bookingId) {
    return res.status(400).json({ message: "Valid booking id is required" });
  }
  if (!documentId) {
    return res.status(400).json({ message: "Valid document id is required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, file_url FROM guest_identifications WHERE id = ? AND booking_id = ? LIMIT 1",
      [documentId, bookingId],
    );
    const row = rows[0];

    if (!row) {
      return res.status(404).json({ message: "Guest document not found" });
    }

    await db.query(
      "DELETE FROM guest_identifications WHERE id = ? AND booking_id = ?",
      [documentId, bookingId],
    );

    const uploadsDir = path.join(__dirname, "..", "uploads");
    if (row.file_url && row.file_url.startsWith("/uploads/")) {
      const target = path.resolve(uploadsDir, path.basename(row.file_url));
      fs.promises.unlink(target).catch(() => {});
    }

    res.json({ message: "Guest document deleted successfully", documentId });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Guest document delete failed:", error);
    }
    res.status(500).json({ message: "Guest document delete failed", error: error.message });
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
