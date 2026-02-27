const bcrypt = require("bcryptjs");
const { findUserByEmail } = require("../models/UserModel");

exports.login = (req, res) => {
  const { email, password } = req.body;

  findUserByEmail(email, async (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error" });

    if (result.length === 0) {
      return res.status(400).json({ message: "Invalid Email" });
    }

    const user = result[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    res.json({
      token: "dummy-token",
      name: user.name,
      role: user.role,
      email: user.email,
    });
  });
};