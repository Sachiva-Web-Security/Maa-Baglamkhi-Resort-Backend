const router = require("express").Router();
const {
  createInvoice,
  getAllInvoices,
  getInvoiceByBookingId
} = require("../controller/InvoiceController");

router.post("/create", createInvoice);
router.get("/all", getAllInvoices);
router.get("/:bookingId", getInvoiceByBookingId);  // new route

module.exports = router;