const db = require("../config/db");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const UsersModel = require("../models/UsersModel");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role_id || user.role,
    avatar_url: user.avatar_url || null,
  };
}

// ================= UPLOAD SETUP =================

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext)
      ? ext
      : ".jpg";

    const userPart = req.user?.id ? `u${req.user.id}` : "user";
    cb(null, `avatar_${userPart}_${Date.now()}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(
    file.mimetype
  );
  cb(ok ? null : new Error("Only JPG/PNG/WEBP images allowed"), ok);
};

exports.avatarUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ================= CREATE USER =================

exports.createUser = async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "name, email, password and role required" });
  }

  try {
    const existing = await UsersModel.findByEmail(email).then(rows => rows[0] || null);
    if (existing) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, 'active')",
      [name, email, hashedPassword, String(role).toLowerCase()]
    );

    return res.json({
      message: "User created successfully",
      user: {
        id: null,
        name,
        email,
        role: String(role).toLowerCase(),
      },
    });
  } catch (hashErr) {
    console.error("Create error:", hashErr);
    return res.status(500).json({
      message: "User creation failed",
    });
  }
};

// ================= GET USERS =================

exports.getUsers = async (req, res) => {
  try {
    const rows = await UsersModel.findAll();
    res.json(rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Error fetching users" });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "User id required" });
  }

  try {
    const [rows] = await UsersModel.findById(id);
    const existingUser = rows[0] || null;
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    req.setAuditContext?.({
      action: "delete_user",
      oldValue: sanitizeUser(existingUser),
      newValue: null,
      userId: req.user?.id || existingUser.id,
    });

    await runQuery("DELETE FROM users WHERE id = ?", [id]);
    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "User delete failed" });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: "User id required" });
  }

  if (!name || !email || !role) {
    return res.status(400).json({ message: "name, email and role required" });
  }

  try {
    const [rows] = await UsersModel.findById(id);
    const existingUser = rows[0] || null;
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : "";
    const nextUser = {
      ...sanitizeUser(existingUser),
      id: Number(id),
      name,
      email,
      role,
    };

    req.setAuditContext?.({
      action: "update_user",
      oldValue: sanitizeUser(existingUser),
      newValue: nextUser,
      userId: req.user?.id || existingUser.id,
    });

    await runQuery(
      "UPDATE users SET name = ?, email = ?, role_id = ?, password_hash = ?, updated_at = NOW() WHERE id = ?",
      [name, email, role, hashedPassword || existingUser.password_hash, id]
    );

    return res.json({
      message: "User updated successfully",
      user: nextUser,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

exports.getMe = async (req, res) => {
  const email = req.user?.email;

  if (!email) {
    return res.status(400).json({ message: "Missing user context" });
  }

  try {
    const [rows] = await UsersModel.findByEmail(email);
    const user = rows[0] || null;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: String(user.role_id || user.role || "").toLowerCase(),
      phone: user.phone || null,
      avatarUrl: user.avatar_url || null,
    });
  } catch (err) {
    return res.status(500).json({ message: "DB Error" });
  }
};

exports.updateMyPhone = async (req, res) => {
  const email = req.user?.email;
  const { phone } = req.body || {};

  if (!email) {
    return res.status(400).json({ message: "Missing user context" });
  }

  const digitsOnly = String(phone || "").replace(/\D+/g, "").slice(0, 15);
  if (!digitsOnly) {
    return res.status(400).json({ message: "Please provide a valid phone number" });
  }

  try {
    const [result] = await db.query("UPDATE users SET phone = ?, updated_at = NOW() WHERE email = ?", [digitsOnly, email]);

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Phone number updated successfully.",
      phone: digitsOnly,
    });
  } catch (err) {
    return res.status(500).json({ message: "DB Error", error: err.message });
  }
};

// ================= CHANGE PASSWORD =================

exports.changePassword = async (req, res) => {
  const emailFromToken = req.user?.email;
  const { email, currentPassword, newPassword } = req.body || {};

  const targetEmail = emailFromToken || email;

  if (!targetEmail || !currentPassword || !newPassword) {
    return res.status(400).json({
      message: "email, currentPassword, newPassword required",
    });
  }

  if (emailFromToken && email && emailFromToken !== email) {
    return res.status(403).json({
      message: "Cannot change another user's password",
    });
  }

  try {
    const [rows] = await UsersModel.findByEmail(targetEmail);
    const user = rows[0] || null;

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash || user.password);
    if (!match) {
      return res.status(400).json({
        message: "Current password incorrect",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    req.setAuditContext?.({
      action: "change_password",
      userId: user.id,
      oldValue: { id: user.id, email: user.email, password: "[REDACTED]" },
      newValue: { id: user.id, email: user.email, password: "[REDACTED]" },
    });

    await runQuery("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE email = ?", [hashed, targetEmail]);

    return res.json({
      message: "Password updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to update password",
    });
  }
};

// ================= UPDATE AVATAR =================

exports.updateMyAvatar = async (req, res) => {
  const emailFromToken = req.user?.email;
  const emailFromBody = req.body?.email;
  const email = emailFromToken || emailFromBody;

  if (emailFromToken && emailFromBody && emailFromToken !== emailFromBody) {
    return res.status(403).json({
      message: "Cannot update another user's avatar",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      message: "No avatar file uploaded (field name: avatar)",
    });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;

  try {
    const [rows] = await UsersModel.findByEmail(email);
    const existingUser = rows[0] || null;

    req.setAuditContext?.({
      action: "update_profile_avatar",
      userId: req.user?.id || existingUser?.id || null,
      oldValue: sanitizeUser(existingUser),
      newValue: {
        ...sanitizeUser(existingUser),
        avatar_url: avatarUrl,
      },
    });

    await runQuery("UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE email = ?", [avatarUrl, email]);

    return res.json({
      message: "Avatar updated",
      avatarUrl,
      persisted: true,
    });
  } catch (err) {
    return res.json({
      message: "Avatar uploaded (not persisted in DB)",
      avatarUrl,
      persisted: false,
    });
  }
};

exports.updateMe = async (req, res) => {
  const id = req.user?.id;
  const { name, email } = req.body || {};

  if (!id) {
    return res.status(401).json({ message: "Missing authenticated user" });
  }

  if (!name || !email) {
    return res.status(400).json({ message: "name and email required" });
  }

  try {
    const [rows] = await UsersModel.findById(id);
    const existingUser = rows[0] || null;
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const nextUser = {
      ...sanitizeUser(existingUser),
      name,
      email,
    };

    req.setAuditContext?.({
      action: "update_profile",
      userId: id,
      oldValue: sanitizeUser(existingUser),
      newValue: nextUser,
    });

    await runQuery("UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE id = ?", [name, email, id]);

    return res.json({
      message: "Profile updated successfully",
      user: nextUser,
    });
  } catch (err) {
    return res.status(500).json({ message: "Profile update failed" });
  }
};
