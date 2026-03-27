const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const UserModel = require("../models/UserModel");

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
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

  UserModel.findUserByEmail(email, async (err, existing) => {
    if (err) {
      return res.status(500).json({ message: "DB Error" });
    }

    if (existing && existing.length > 0) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      UserModel.createUser(
        {
          name,
          email,
          password: hashedPassword,
          role: String(role).toLowerCase(),
        },
        (createErr, result) => {
          if (createErr) {
            console.error("Create error:", createErr);
            return res.status(500).json({
              message: "User creation failed",
            });
          }

          return res.json({
            message: "User created successfully",
            user: {
              id: result?.insertId,
              name,
              email,
              role: String(role).toLowerCase(),
            },
          });
        }
      );
    } catch (hashErr) {
      console.error("Hash error:", hashErr);
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  });
};

// ================= GET USERS =================

exports.getUsers = (req, res) => {
  UserModel.getAllUsers((err, result) => {
    if (err) {
      console.error("Error fetching users:", err);
      return res.status(500).json({
        message: "Error fetching users",
      });
    }

    res.json(result);
  });
};

exports.deleteUser = (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "User id required" });
  }

  UserModel.findUserById(id, (findErr, rows) => {
    if (findErr) {
      console.error("Error loading user before delete:", findErr);
      return res.status(500).json({ message: "User delete failed" });
    }

    const existingUser = rows?.[0];
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    req.setAuditContext?.({
      action: "delete_user",
      oldValue: sanitizeUser(existingUser),
      newValue: null,
      userId: req.user?.id || existingUser.id,
    });

    UserModel.deleteUserById(id, (err, result) => {
      if (err) {
        console.error("Error deleting user:", err);
        return res.status(500).json({ message: "User delete failed" });
      }

      if (!result?.affectedRows) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({ message: "User deleted successfully" });
    });
  });
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

  UserModel.findUserById(id, async (findErr, rows) => {
    if (findErr) {
      console.error("Error loading user before update:", findErr);
      return res
        .status(500)
        .json({ message: "User update failed", error: findErr.message });
    }

    const existingUser = rows?.[0];
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    try {
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

      UserModel.updateUserById(
        id,
        { name, email, role, password: hashedPassword },
        (err, result) => {
          if (err) {
            console.error("Error updating user:", err);
            return res
              .status(500)
              .json({ message: "User update failed", error: err.message });
          }

          if (!result?.affectedRows) {
            return res.status(404).json({ message: "User not found" });
          }

          return res.json({
            message: "User updated successfully",
            user: nextUser,
          });
        }
      );
    } catch (err) {
      console.error("Error updating user:", err);
      return res
        .status(500)
        .json({ message: "Internal server error", error: err.message });
    }
  });
};

exports.getMe = (req, res) => {
  const email = req.user?.email;

  if (!email) {
    return res.status(400).json({
      message: "Missing user context",
    });
  }

  UserModel.findUserByEmail(email, (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error" });

    if (!result || result.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = result[0];

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url || null,
    });
  });
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

  UserModel.findUserByEmail(targetEmail, async (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error" });

    if (!result || result.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = result[0];

    const match = await bcrypt.compare(currentPassword, user.password);
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

    UserModel.updatePasswordByEmail(targetEmail, hashed, (uErr) => {
      if (uErr) {
        return res.status(500).json({
          message: "Failed to update password",
        });
      }

      return res.json({
        message: "Password updated successfully",
      });
    });
  });
};

// ================= UPDATE AVATAR =================

exports.updateMyAvatar = (req, res) => {
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

  UserModel.findUserByEmail(email, (findErr, result) => {
    if (findErr) {
      return res.status(500).json({
        message: "DB Error",
      });
    }

    const existingUser = result?.[0] || null;

    req.setAuditContext?.({
      action: "update_profile_avatar",
      userId: req.user?.id || existingUser?.id || null,
      oldValue: sanitizeUser(existingUser),
      newValue: {
        ...sanitizeUser(existingUser),
        avatar_url: avatarUrl,
      },
    });

    UserModel.updateAvatarUrlByEmail(email, avatarUrl, (err) => {
      if (err) {
        return res.json({
          message: "Avatar uploaded (not persisted in DB)",
          avatarUrl,
          persisted: false,
        });
      }

      return res.json({
        message: "Avatar updated",
        avatarUrl,
        persisted: true,
      });
    });
  });
};

exports.updateMe = (req, res) => {
  const id = req.user?.id;
  const { name, email } = req.body || {};

  if (!id) {
    return res.status(401).json({ message: "Missing authenticated user" });
  }

  if (!name || !email) {
    return res.status(400).json({ message: "name and email required" });
  }

  UserModel.findUserById(id, (findErr, rows) => {
    if (findErr) {
      return res.status(500).json({ message: "DB Error" });
    }

    const existingUser = rows?.[0];
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

    UserModel.updateUserById(
      id,
      { name, email, role: existingUser.role, password: "" },
      (updateErr, result) => {
        if (updateErr) {
          return res.status(500).json({ message: "Profile update failed" });
        }

        if (!result?.affectedRows) {
          return res.status(404).json({ message: "User not found" });
        }

        return res.json({
          message: "Profile updated successfully",
          user: nextUser,
        });
      }
    );
  });
};
