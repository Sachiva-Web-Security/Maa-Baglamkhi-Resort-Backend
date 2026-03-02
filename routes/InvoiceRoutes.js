const router = require("express").Router();
const {
  createInvoice,
  getAllInvoices,
  getInvoiceByBookingId,
  updateInvoice,
} = require("../controller/InvoiceController");

router.post("/create", createInvoice);
router.get("/all", getAllInvoices);
router.get("/by-booking/:bookingId", getInvoiceByBookingId);
router.put("/update/:id", updateInvoice);

module.exports = router;