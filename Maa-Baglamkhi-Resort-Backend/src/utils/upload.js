const multer = require("multer");
const fs = require("fs");
const path = require("path");

const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    },
});

const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
]);

const fileFilter = (req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Only images and PDF documents are allowed"), false);
    }
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
});

// Multer parses multipart/form-data into req.body even when it stores nothing.
// Routes that only need the text fields point multer at memory storage so the
// form fields survive and the (unused) file never touches disk.
const memoryStorage = multer({
    limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = upload;
module.exports.memoryStorage = memoryStorage;
