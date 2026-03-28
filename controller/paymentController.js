const Payment = require("../models/PaymentModel");

exports.createPayment = (req, res) => {
  const { table, total, method } = req.body;

  Payment.createPayment(
    { table, total, method },
    (err, result) => {
      if (err) {
        if (err.code === "PAYMENTS_TABLE_UNAVAILABLE") {
          return res.status(503).json({
            message: "Payments module is temporarily unavailable until the payments table is repaired.",
          });
        }

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
    if (err) {
      if (err.code === "PAYMENTS_TABLE_UNAVAILABLE") {
        return res.status(503).json({
          message: "Payments module is temporarily unavailable until the payments table is repaired.",
        });
      }

      return res.status(500).json(err);
    }

    res.json(data);
  });
};
