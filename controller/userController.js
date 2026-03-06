const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const UserModel = require("../models/UserModel");

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    const userPart = req.user?.id ? `u${req.user.id}` : "user";
    cb(null, `avatar_${userPart}_${Date.now()}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Only JPG/PNG/WEBP images allowed"), ok);
};

// Exported for route usage
exports.avatarUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

exports.createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    UserModel.createUser(
      { name, email, password: hashedPassword, role },
      (err, result) => {
        if (err) {
          console.error("Error creating user:", err);
          return res
            .status(500)
            .json({ message: "User creation failed", error: err.message });
        }

        res.json({ message: "User created successfully" });
      }
    );
  } catch (err) {
    console.error("Error hashing password:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

exports.getUsers = (req, res) => {
  UserModel.getAllUsers((err, result) => {
    if (err) {
      console.error("Error fetching users:", err);
      return res.status(500).json({ message: "Error fetching users" });
    }

    res.json(result);
  });
};

exports.getMe = (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(400).json({ message: "Missing user context" });

  UserModel.findUserByEmail(email, (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error" });
    if (!result || result.length === 0) return res.status(404).json({ message: "User not found" });

    const user = result[0];
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url || user.avatarUrl || null,
    });
  });
};

exports.changePassword = async (req, res) => {
  const emailFromToken = req.user?.email;
  const { email, currentPassword, newPassword } = req.body || {};

  const targetEmail = emailFromToken || email;
  if (!targetEmail || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "email, currentPassword, newPassword required" });
  }

  // If client sends email, it must match token user
  if (emailFromToken && email && emailFromToken !== email) {
    return res.status(403).json({ message: "Cannot change another user's password" });
  }

  UserModel.findUserByEmail(targetEmail, async (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error" });
    if (!result || result.length === 0) return res.status(404).json({ message: "User not found" });

    const user = result[0];
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: "Current password incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    UserModel.updatePasswordByEmail(targetEmail, hashed, (uErr) => {
      if (uErr) return res.status(500).json({ message: "Failed to update password" });
      return res.json({ message: "Password updated successfully" });
    });
  });
};

exports.updateMyAvatar = (req, res) => {
  const emailFromToken = req.user?.email;
  const emailFromBody = req.body?.email;
  const email = emailFromToken || emailFromBody;

  if (emailFromToken && emailFromBody && emailFromToken !== emailFromBody) {
    return res.status(403).json({ message: "Cannot update another user's avatar" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "No avatar file uploaded (field name: avatar)" });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  // Try to persist if DB column exists; otherwise still return URL so frontend works.
  UserModel.updateAvatarUrlByEmail(email, avatarUrl, (err) => {
    if (err) {
      return res.json({
        message: "Avatar uploaded (not persisted in DB). Add avatar_url column to persist.",
        avatarUrl,
        persisted: false,
      });
    }
    return res.json({ message: "Avatar updated", avatarUrl, persisted: true });
  });
};