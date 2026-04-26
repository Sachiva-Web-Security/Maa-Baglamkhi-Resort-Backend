const express = require("express");
const {
  createInquiryController,
  getAllInquiriesController,
} = require("../controller/inquiryController");

const router = express.Router();

router.post("/", createInquiryController);
router.get("/", getAllInquiriesController);

module.exports = router;
