const db = require("../config/db");
const guestDocumentModel = require("../models/guestDocumentModel");

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

    const result = await guestDocumentModel.createDocument({
      bookingId,
      mobile: guest.mobile || "",
      guestName: guest.guest_name || "",
      documentType: normalizeDocumentType(req.body.documentType),
      fileUrl,
      termsAccepted: parseBoolean(req.body.termsAccepted),
      notes: req.body.notes,
      uploadedBy: req.body.uploadedBy,
    });

    const documents = await guestDocumentModel.getDocumentsByBookingId(bookingId);
    const document = documents.find((row) => Number(row.id) === Number(result.insertId)) || null;

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
    const documents = await guestDocumentModel.getDocumentsByBookingId(bookingId);
    res.json(documents);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Guest document fetch failed:", error);
    }
    res.status(500).json({ message: "Guest document fetch failed", error: error.message });
  }
};
