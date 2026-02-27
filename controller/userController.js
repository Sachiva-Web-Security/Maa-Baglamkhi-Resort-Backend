const bcrypt = require("bcryptjs");
const UserModel = require("../models/UserModel");

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