const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");
const {
  getJwtSecret,
  getCookieOptions,
  clearCookieOptions,
  AUTH_COOKIE_NAME,
} = require("../config/security");
const { HttpError } = require("../middleware/errorHandler");

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const ALLOW_REGISTER = String(process.env.ALLOW_REGISTER || "").toLowerCase() === "true";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: String(user.role || "").toLowerCase(),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
}

exports.login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    req.setAuditContext?.({
      action: "login",
      newValue: email ? { email } : null,
    });

    if (!email || !password) {
      throw new HttpError(400, "Email and password required");
    }

    const user = await new Promise((resolve, reject) => {
      UserModel.findUserByEmail(email, (err, result) => {
        if (err) return reject(err);
        if (!result || result.length === 0) return resolve(null);
        resolve(result[0]);
      });
    });

    if (!user) {
      throw new HttpError(400, "Invalid Email");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.setAuditContext?.({
        action: "login_failed",
        userId: user.id,
      });
      throw new HttpError(400, "Invalid Password");
    }

    const token = signToken(user);
    setAuthCookie(res, token);

    req.setAuditContext?.({
      userId: user.id,
      action: "login",
      newValue: {
        id: user.id,
        email: user.email,
        role: String(user.role || "").toLowerCase(),
      },
    });

    return res.json({
      token,
      name: user.name,
      role: String(user.role || "").toLowerCase(),
      email: user.email,
    });
  } catch (err) {
    return next(err);
  }
};

exports.logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, clearCookieOptions());
  req.setAuditContext?.({ action: "logout" });
  return res.json({ message: "Logged out" });
};

exports.me = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  return res.json({
    id: req.user.id || null,
    email: req.user.email || null,
    name: req.user.name || null,
    role: req.user.role || null,
  });
};

exports.refresh = (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Not authenticated");
    }
    const token = signToken({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    });
    setAuthCookie(res, token);
    return res.json({ message: "Token refreshed" });
  } catch (err) {
    return next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      throw new HttpError(400, "name, email, password required");
    }

    const userCount = await new Promise((resolve, reject) => {
      UserModel.countUsers((err, count) => (err ? reject(err) : resolve(count)));
    });

    if (!ALLOW_REGISTER && userCount > 0) {
      throw new HttpError(403, "Registration is disabled. Ask admin to create a user.");
    }

    const existing = await new Promise((resolve, reject) => {
      UserModel.findUserByEmail(normalizedEmail, (err, rows) =>
        err ? reject(err) : resolve(rows),
      );
    });
    if (existing && existing.length > 0) {
      throw new HttpError(400, "Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedRole = role ? String(role).toLowerCase() : "admin";

    await new Promise((resolve, reject) => {
      UserModel.createUser(
        { name, email: normalizedEmail, password: hashedPassword, role: normalizedRole },
        (err) => (err ? reject(err) : resolve()),
      );
    });

    return res.json({ message: "Registered successfully" });
  } catch (err) {
    return next(err);
  }
};
