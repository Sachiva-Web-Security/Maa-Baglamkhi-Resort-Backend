const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const ALLOW_REGISTER = String(process.env.ALLOW_REGISTER || "").toLowerCase() === "true";

exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  UserModel.findUserByEmail(email, async (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error" });

    if (!result || result.length === 0) {
      return res.status(400).json({ message: "Invalid Email" });
    }

    const user = result[0];

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      name: user.name,
      role: user.role,
      email: user.email,
    });
  });
};

/**
 * Register endpoint (for initial setup).
 * - Allowed if ALLOW_REGISTER=true OR there are no users in DB yet.
 * - Creates user in `register` with hashed password.
 */
exports.register = (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email, password required" });
  }

  UserModel.countUsers(async (countErr, count) => {
    if (countErr) return res.status(500).json({ message: "DB Error" });

    const allowed = ALLOW_REGISTER || count === 0;
    if (!allowed) {
      return res.status(403).json({
        message: "Registration is disabled. Ask admin to create a user.",
      });
    }

    UserModel.findUserByEmail(email, async (err, existing) => {
      if (err) return res.status(500).json({ message: "DB Error" });
      if (existing && existing.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const normalizedRole = role ? String(role) : "admin";
        UserModel.createUser(
          { name, email, password: hashedPassword, role: normalizedRole },
          (createErr) => {
            if (createErr) {
              return res.status(500).json({ message: "User creation failed" });
            }
            return res.json({ message: "Registered successfully" });
          }
        );
      } catch (hashErr) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });
  });
};
