const router = require("express").Router();
const {
  createUser,
  getUsers,
  getMe,
  changePassword,
  updateMyAvatar,
  avatarUpload,
} = require("../controller/userController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Protected routes
router.get("/me", authMiddleware, getMe);
router.post("/change-password", authMiddleware, changePassword);
router.put("/me/avatar", authMiddleware, avatarUpload.single("avatar"), updateMyAvatar);

// ✅ FIXED
router.post("/", authMiddleware, roleMiddleware(["admin"]), createUser);
router.get("/", authMiddleware, getUsers);

module.exports = router;