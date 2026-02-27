const express = require("express");
const router = express.Router();

const {
  getTables,
  addTable
} = require("../controller/tableController");

router.get("/", getTables);
router.post("/", addTable);

module.exports = router;