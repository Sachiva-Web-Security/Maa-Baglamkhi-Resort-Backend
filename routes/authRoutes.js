const router = require("express").Router();
const { login } = require("../controller/authController");

router.post("/login", login);

module.exports = router;