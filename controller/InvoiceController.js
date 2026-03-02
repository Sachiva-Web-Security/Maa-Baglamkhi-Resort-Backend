const InvoiceModel = require("../models/InvoiceModel");
const AccountsModel = require("../models/AccountsModel");

exports.createInvoice = (req, res) => {
  const invoice = req.body;

  if (!invoice.invoiceNo || !invoice.customerName || !invoice.finalTotal) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  InvoiceModel.createInvoice(invoice, (err, result) => {
    if (err) {
      console.error("Error creating invoice:", err);
      return res.status(500).json({ message: "Error creating invoice" });
    }

    // ALSO SAVE AS INCOME (automatic entry)
    AccountsModel.createTransaction(
      {
        date: invoice.date,
        type: "Income",
        description: `Invoice ${invoice.invoiceNo} - ${invoice.customerName}`,
        amount: invoice.finalTotal,
        paymentMode: invoice.paymentMode,
      },
      (err2) => {
        if (err2) {
          console.error("Error adding invoice to accounts:", err2);
        }

        res.json({
          message: "Invoice created successfully",
          id: result.insertId,
        });
      }
    );
  });
};


exports.getAllInvoices = (req, res) => {
  InvoiceModel.getAllInvoices((err, results) => {
    if (err) {
      console.error("Error fetching invoices:", err);
      return res.status(500).json({ message: "Error fetching invoices" });
    }
    res.json(results);
  });
};