const router = require("express").Router();
const { list, getById, update, remove } = require("../models/fbInvoiceModel");

router.get("/", async (req, res) => {
  try {
    res.json(
      await list({
        from: req.query.from || "",
        to: req.query.to || "",
        invoice_no: req.query.invoice_no || "",
        customer: req.query.customer || "",
        contact: req.query.contact || "",
        table_no: req.query.table_no || "",
        type: req.query.type || "",
        status: req.query.status || "",
        amount_from: req.query.amount_from || "",
        amount_to: req.query.amount_to || "",
        payment_mode: req.query.payment_mode || "",
        sort_rate: req.query.sort_rate || "",
      }),
    );
  } catch (error) {
    res.status(500).json({ message: "Failed to load invoices" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const inv = await getById(req.params.id);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  } catch (error) {
    res.status(500).json({ message: "Failed to load invoice" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const inv = await update(req.params.id, req.body);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to save" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await remove(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
