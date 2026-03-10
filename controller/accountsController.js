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

exports.getSummary = (req, res) => {
  AccountsModel.getSummary((err, results) => {
    if (err) {
      console.error("Error fetching summary:", err);
      return res.status(500).json({ message: "Error fetching summary" });
    }

    const income = Number(results[0].totalIncome) || 0;
    const expense = Number(results[0].totalExpense) || 0;
    const net = income - expense;
    const gstPayable = Math.round(income * 0.05);

    res.json({ income, expense, net, gstPayable });
  });
};