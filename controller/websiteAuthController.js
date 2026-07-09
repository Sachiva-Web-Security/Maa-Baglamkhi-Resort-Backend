const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  createCustomerTable,
  findCustomerByEmail,
  createCustomer,
  findCustomerById,
  normalizeEmail,
  updateCustomerById,
} = require("../models/CustomerModel");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

// ✅ REGISTER
exports.registerCustomer = async (req, res) => {
  try {
    await createCustomerTable();

    const { first_name, last_name, email, phone, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!first_name || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const existing = await findCustomerByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const id = await createCustomer({
      first_name,
      last_name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
    });

    res.json({ message: "Signup successful", userId: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ LOGIN
exports.loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    await createCustomerTable();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await findCustomerByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: "customer" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login success",
      token,
      user: {
        id: user.id,
        name: user.first_name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ GET ME
exports.getMe = async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!auth) {
      return res.status(401).json({ message: "No token" });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await findCustomerById(decoded.id);

    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};





exports.updateMe = async (req, res) => {
  try {
    await createCustomerTable();
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ message: "No token" });
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { first_name, last_name, phone } = req.body || {};
    const ok = await updateCustomerById(decoded.id, { first_name, last_name, phone });
    if (!ok) return res.status(404).json({ message: "User not found" });
    const user = await findCustomerById(decoded.id);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(401).json({ message: err.message || "Invalid token" });
  }
};