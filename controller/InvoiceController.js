const InvoiceModel = require("../models/InvoiceModel");
const AccountsModel = require("../models/AccountsModel");
const HotelModel = require("../models/HotelModel");

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

    const invoiceId = result.insertId;

    // Mark booking as billed if bookingId is provided
    if (invoice.bookingId) {
      HotelModel.markBillGenerated(invoice.bookingId, (err2) => {
        if (err2) console.error("Error marking bill generated:", err2);
      });
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
      (err3) => {
        if (err3) {
          console.error("Error adding invoice to accounts:", err3);
        }

        res.json({
          message: "Invoice created successfully",
          id: invoiceId,
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

exports.getInvoiceByBookingId = (req, res) => {
  const { bookingId } = req.params;
  InvoiceModel.getInvoiceByBookingId(bookingId, (err, results) => {
    if (err) {
      console.error("Error fetching invoice:", err);
      return res.status(500).json({ message: "Error fetching invoice" });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(results[0]);
  });
};

exports.updateInvoice = (req, res) => {
  const { id } = req.params;
  const invoice = req.body;
  InvoiceModel.updateInvoice(id, invoice, (err) => {
    if (err) {
      console.error("Error updating invoice:", err);
      return res.status(500).json({ message: "Error updating invoice" });
    }
    res.json({ message: "Invoice updated successfully" });
  });
};
