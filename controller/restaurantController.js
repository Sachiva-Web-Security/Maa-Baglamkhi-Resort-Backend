const Restaurant = require("../models/RestaurantModel");

/* ================= TABLE ================= */

exports.addTable = (req, res) => {
  const number = req.body.number;

  if (!number)
    return res.status(400).json({ message: "Table number required" });

  Restaurant.addTable({ number }, (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "Table already exists" });
      }
      return res.status(500).json(err);
    }

    res.json({
      message: "Table added",
      id: result.insertId,
    });
  });
};

exports.getTables = (req, res) => {
  Restaurant.getTables((err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};

/* ================= MENU ================= */

exports.addMenuItem = (req, res) => {
  const { name, price, category, tableNumber } = req.body;

  if (!name || !price)
    return res.status(400).json({ message: "Name and price required" });

  Restaurant.addMenuItem(
    { name, price, category, tableNumber },
    (err, result) => {
      if (err) return res.status(500).json(err);

      res.json({
        message: "Menu item added",
        id: result.insertId,
      });
    }
  );
};

exports.getMenuItems = (req, res) => {
  const tableNumber = req.query.tableNumber;

  Restaurant.getMenuItems({ tableNumber }, (err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};



exports.getOrderItems = (req, res) => {
  const orderId = req.params.orderId;

  Restaurant.getOrderItems(orderId, (err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};




/* ================= ORDER ================= */

exports.addOrderItem = (req, res) => {
  const { tableNumber, item } = req.body;

  Restaurant.getPendingOrder(tableNumber, (err, order) => {
    if (err) return res.status(500).json(err);

    if (!order) {
      Restaurant.createOrder(tableNumber, (err2, result) => {
        if (err2) return res.status(500).json(err2);

        const orderId = result.insertId;

        Restaurant.addItemToOrder(orderId, item, (err3) => {
          if (err3) return res.status(500).json(err3);

          res.json({
            message: "Order created",
            orderId,
          });
        });
      });
    } else {
      Restaurant.addItemToOrder(order.id, item, (err4) => {
        if (err4) return res.status(500).json(err4);

        res.json({
          message: "Item added",
          orderId: order.id,
        });
      });
    }
  });
};

exports.getOrder = (req, res) => {
  const tableNumber = req.params.tableNumber;

  Restaurant.getPendingOrder(tableNumber, (err, data) => {
    if (err) return res.status(500).json(err);

    res.json(data);
  });
};

/* ================= BILL ================= */

exports.createBill = (req, res) => {
  Restaurant.createBill(req.body, (err, result) => {
    if (err) return res.status(500).json(err);

    res.json({
      message: "Bill created",
      id: result.insertId,
    });
  });
};