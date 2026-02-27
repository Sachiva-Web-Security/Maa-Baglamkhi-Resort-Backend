const RestaurantModel = require("../models/RestaurantModel");

exports.createBill = (req, res) => {
  const { table, items, subtotal, gst, total, paymentMethod } = req.body;

  if (!table || !Array.isArray(items) || !total || !paymentMethod) {
    return res.status(400).json({ message: "Missing bill fields" });
  }

  RestaurantModel.createBill(
    { table, items, subtotal, gst, total, paymentMethod },
    (err, result) => {
      if (err) {
        console.error("Error creating restaurant bill:", err);
        return res
          .status(500)
          .json({ message: "Error saving bill", error: err.message });
      }

      res.json({
        message: "Bill saved successfully",
        billId: result.insertId,
      });
    }
  );
};

