const RestaurantModel = require("../models/RestaurantModel");

// ------------------- TABLES -------------------
exports.addTable = (req, res) => {
  const { number, status, guestCount } = req.body;
  if (!number || !guestCount)
    return res.status(400).json({ message: "Missing table fields" });

  // validate status
  const validStatus = ["Available", "Occupied", "Reserved"];
  if (!validStatus.includes(status)) return res.status(400).json({ message: "Invalid table status" });

  RestaurantModel.addTable({ number, status, guestCount }, (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.status(201).json({ 
      message: "Table added successfully", 
      table: { id: result.insertId, number, status, guestCount } 
    });
  });
};

exports.getTables = (req, res) => {
  RestaurantModel.getTables((err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(result);
  });
};

// ------------------- ORDERS -------------------
exports.addItem = (req, res) => {
  const { tableNumber, item } = req.body;
  if (!tableNumber || !item || !item.name || !item.price)
    return res.status(400).json({ message: "Missing fields" });

  // Ensure tableNumber has "T" prefix
  let tableNum = tableNumber.toString();
  if (!tableNum.startsWith("T")) tableNum = `T${tableNum}`;

  RestaurantModel.getPendingOrder(tableNum, (err, order) => {
    if (err) return res.status(500).json({ message: err.message });

    const addItemCallback = (orderId) => {
      RestaurantModel.addItemToOrder(orderId, { ...item, quantity: item.quantity || 1 }, (err2, result) => {
        if (err2) return res.status(500).json({ message: err2.message });
        res.json({ 
          message: "Item added", 
          orderId,
          item: { id: result.insertId, ...item, quantity: item.quantity || 1 } // send DB id to frontend
        });
      });
    };

    if (!order) {
      RestaurantModel.createOrder(tableNum, (err3, newOrder) => {
        if (err3) return res.status(500).json({ message: err3.message });
        addItemCallback(newOrder.id);
      });
    } else {
      addItemCallback(order.id);
    }
  });
};

exports.getPendingOrder = (req, res) => {
  let { tableNumber } = req.params;
  if (!tableNumber) return res.status(400).json({ message: "Table number required" });

  // Ensure tableNumber has "T" prefix
  if (!tableNumber.toString().startsWith("T")) tableNumber = `T${tableNumber}`;

  RestaurantModel.getPendingOrder(tableNumber, (err, order) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (!order) {
      // No pending order, return empty response
      return res.json({ items: [], subtotal: 0, gst: 0, total: 0, billId: null });
    }

    const subtotal = order.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const gst = subtotal * 0.05;
    const total = subtotal + gst;

    res.json({ orderId: order.id, items: order.items, subtotal, gst, total });
  });
};

// ------------------- BILLING -------------------
exports.generateBill = (req, res) => {
  let { tableNumber, paymentMethod } = req.body;
  if (!tableNumber || !paymentMethod) return res.status(400).json({ message: "Missing fields" });

  // Ensure tableNumber has "T" prefix
  if (!tableNumber.toString().startsWith("T")) {
    tableNumber = `T${tableNumber}`;
  }

  RestaurantModel.getPendingOrder(tableNumber, (err, order) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!order) return res.status(400).json({ message: "No pending order" });

    const subtotal = order.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const gst = subtotal * 0.05;
    const total = subtotal + gst;

    RestaurantModel.createBill(
      { table: tableNumber, items: order.items, subtotal, gst, total, paymentMethod },
      (err2, result) => {
        if (err2) return res.status(500).json({ message: err2.message });

        RestaurantModel.markOrderPaid(order.id, (err3) => {
          if (err3) console.error("Mark order paid failed", err3.message);
        });

        res.json({ message: "Bill generated", billId: result.insertId, subtotal, gst, total });
      }
    );
  });
};