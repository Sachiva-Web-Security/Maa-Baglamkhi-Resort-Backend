const AccountsModel = require("../models/AccountsModel");

exports.getTransactions = (req, res) => {
  AccountsModel.getTransactions((err, rows) => {
    if (err) {
      console.error("Error fetching transactions:", err);
      return res.status(500).json({ message: "Error fetching transactions" });
    }
    res.json(rows);
  });
};

exports.addIncome = (req, res) => {
  const { date, description, amount, paymentMode } = req.body;
  if (!date || !description || amount == null || !paymentMode) {
    return res.status(400).json({ message: "Missing fields" });
  }

  AccountsModel.createTransaction(
    { date, type: "Income", description, amount, paymentMode },
    (err, result) => {
      if (err) {
        console.error("Error adding income:", err);
        return res.status(500).json({ message: "Error adding income" });
      }
      res.json({ message: "Income added", id: result.insertId });
    }
  );
};

exports.addExpense = (req, res) => {
  const { date, description, amount, paymentMode } = req.body;
  if (!date || !description || amount == null || !paymentMode) {
    return res.status(400).json({ message: "Missing fields" });
  }

  AccountsModel.createTransaction(
    { date, type: "Expense", description, amount, paymentMode },
    (err, result) => {
      if (err) {
        console.error("Error adding expense:", err);
        return res.status(500).json({ message: "Error adding expense" });
      }
      res.json({ message: "Expense added", id: result.insertId });
    }
  );
};

