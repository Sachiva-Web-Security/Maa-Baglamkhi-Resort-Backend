const router = require("express").Router();
const {
  createUser,
  getUsers,
  deleteUser,
  updateUser,
  getMe,
  updateMe,
  changePassword,
  updateMyAvatar,
  updateMyPhone,
  avatarUpload,
} = require("../controller/userController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Only admin can create users; any authenticated user can list (admin/managers)
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.put("/me/phone", authMiddleware, updateMyPhone);
router.post("/change-password", authMiddleware, changePassword);
router.put("/me/avatar", authMiddleware, avatarUpload.single("avatar"), updateMyAvatar);

router.post("/", authMiddleware, roleMiddleware(["admin"]), createUser);
router.get("/", authMiddleware, getUsers);
router.delete("/:id", authMiddleware, roleMiddleware(["admin"]), deleteUser);
router.put("/:id", authMiddleware, roleMiddleware(["admin"]), updateUser);

module.exports = router;
