const router = require("express").Router();
const {
  createInvoice,
  getAllInvoices,
  getInvoiceByBookingId,
  updateInvoice,
  generateCustomerInvoice,
  updateInvoicePaymentStatus,
} = require("../controller/InvoiceController");

router.post("/create", createInvoice);
router.get("/all", getAllInvoices);
router.get("/by-booking/:bookingId", getInvoiceByBookingId);
router.put("/update/:id", updateInvoice);
router.patch("/payment-status/:id", updateInvoicePaymentStatus);
router.get("/:customerId", generateCustomerInvoice);

module.exports = router;
