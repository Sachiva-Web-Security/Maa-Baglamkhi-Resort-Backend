const db = require("../config/db");
const PaymentsModel = require("../models/PaymentsModel");

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });

exports.createPayment = async (req, res) => {
  const { table, total, method } = req.body || {};

  if (!table || total === undefined || total === null || !method) {
    return res.status(400).json({ message: "table, total, and method are required" });
  }

  try {
    await PaymentsModel.ensureSchema?.();

    const [result] = await runQuery(
      `INSERT INTO payments (booking_id, amount, payment_method_id, payment_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'completed', NOW(), NOW())`,
      [table, Number(total), Number(method), "payment"]
    );

    res.json({
      message: "Payment successful",
      id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Payment failed",
    });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const rows = await PaymentsModel.findAll();
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
};
