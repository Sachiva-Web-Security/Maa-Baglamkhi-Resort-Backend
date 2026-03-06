const router = require("express").Router();
const { login, register } = require("../controller/authController");

router.post("/login", login);
router.post("/register", register);

module.exports = router;