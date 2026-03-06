const router = require("express").Router();
const {
  createUser,
  getUsers,
  getMe,
  changePassword,
  updateMyAvatar,
  avatarUpload,
} = require("../controller/userController");
const roleMiddleware = require("../middleware/roleMiddleware");

// Only admin can create users; any authenticated user can list (admin/managers)
router.get("/me", getMe);
router.post("/change-password", changePassword);
router.put("/me/avatar", avatarUpload.single("avatar"), updateMyAvatar);

router.post("/", roleMiddleware(["admin"]), createUser);
router.get("/", getUsers);

module.exports = router;