const router = require("express").Router();
const { createUser, getUsers } = require("../controller/userController");

router.post("/", createUser);
router.get("/", getUsers);

module.exports = router;