const Payment = require("../models/PaymentModel");

exports.createPayment = (req, res) => {
  const { table, total, method } = req.body;

  Payment.createPayment(
    { table, total, method },
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          message: "Payment failed",
        });
      }

      res.json({
        message: "Payment successful",
        id: result.insertId,
      });
    }
  );
};

exports.getPayments = (req, res) => {
  Payment.getPayments((err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};