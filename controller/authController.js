const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");
const { getJwtSecret } = require("../config/security");

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const ALLOW_REGISTER = String(process.env.ALLOW_REGISTER || "").toLowerCase() === "true";

const LOGIN_EMAIL_ALIASES = {
  "admin@resort.com": "admin@test.com",
  "manager@resort.com": "manager@test.com",
  "reception@resort.com": "reception@test.com",
  "accounts@resort.com": "accounts@test.com",
  "tarun@resort.com": "hk@test.com",
  "waiter@resort.com": "waiter@test.com",
  "waiter@test.com": "waiter@resort.com",
  "kitchen@resort.com": "kitchen@test.com",
  "kitchen@test.com": "kitchen@resort.com",
  "chef@resort.com": "kitchen@test.com",
};

const buildCandidateEmails = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const aliasEmail = LOGIN_EMAIL_ALIASES[normalizedEmail];

  return [aliasEmail, normalizedEmail].filter((value, index, values) => {
    return value && values.indexOf(value) === index;
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const candidateEmails = buildCandidateEmails(normalizedEmail);

  req.setAuditContext?.({
    action: "login",
    newValue: normalizedEmail ? { email: normalizedEmail } : null,
  });

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const tryLookup = (index) => {
    if (index >= candidateEmails.length) {
      return res.status(400).json({ message: "Invalid Email" });
    }

    UserModel.findUserByEmail(candidateEmails[index], async (err, result) => {
      if (err) return res.status(500).json({ message: "DB Error" });

      if (!result || result.length === 0) {
        return tryLookup(index + 1);
      }

      const user = result[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        req.setAuditContext?.({
          action: "login_failed",
          userId: user.id,
        });
        return res.status(400).json({ message: "Invalid Password" });
      }

      req.setAuditContext?.({
        userId: user.id,
        action: "login",
        newValue: {
          id: user.id,
          email: user.email,
          role: String(user.role || "").toLowerCase(),
        },
      });

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: String(user.role || "").toLowerCase(),
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      // Set httpOnly cookie for browser-based sessions
      const isProd = process.env.NODE_ENV === "production";
      const cookieMaxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: cookieMaxAgeMs,
        path: "/",
      });

      return res.json({
        token,
        name: user.name,
        role: String(user.role || "").toLowerCase(),
        email: user.email,
      });
    });
  };

  return tryLookup(0);
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
          },
        );
      } catch (hashErr) {
        return res.status(500).json({ message: "Internal server error" });
      }
    });
  });
};
