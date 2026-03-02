const router = require("express").Router();
const { createInvoice,getAllInvoices } = require("../controller/InvoiceController");

router.post("/create", createInvoice);
router.get("/all", getAllInvoices);

module.exports = router;